import { prisma } from '@/config/database';
import { AppError, HttpStatus } from '@/utils/AppError';
import { getPaginationParams, buildPaginationMeta, paginatedResponse } from '@/utils/pagination.util';
import type { UserStatus, UserRole, KycStatus, WalletCurrency, TransactionStatus } from '@prisma/client';

// ─── Users ───────────────────────────────────────────────────────────────────

export async function listUsers(query: { page?: number; limit?: number; status?: UserStatus; role?: UserRole; search?: string }) {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.role ? { role: query.role } : {}),
    ...(query.search
      ? { OR: [{ email: { contains: query.search, mode: 'insensitive' as const } }, { fullName: { contains: query.search, mode: 'insensitive' as const } }] }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, fullName: true, phone: true, role: true, status: true, emailVerified: true, createdAt: true },
    }),
  ]);

  return paginatedResponse(users, buildPaginationMeta(total, page, limit));
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { kyc: { include: { documents: true } }, wallets: true, bankAccounts: true },
  });
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND);
  return user;
}

export async function updateUserStatus(adminId: string, userId: string, status: UserStatus, reason?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found', HttpStatus.NOT_FOUND);

  const updated = await prisma.user.update({ where: { id: userId }, data: { status } });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: 'UPDATE_USER_STATUS',
      entity: 'User',
      entityId: userId,
      oldValue: { status: user.status },
      newValue: { status, reason },
    },
  });

  return updated;
}

// ─── KYC ─────────────────────────────────────────────────────────────────────

export async function listKyc(query: { page?: number; limit?: number; status?: KycStatus }) {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where = query.status ? { status: query.status } : {};

  const [total, kycs] = await Promise.all([
    prisma.kyc.count({ where }),
    prisma.kyc.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { email: true, fullName: true } },
        documents: { select: { id: true, documentType: true, fileUrl: true } },
      },
    }),
  ]);

  return paginatedResponse(kycs, buildPaginationMeta(total, page, limit));
}

export async function getKycById(kycId: string) {
  const kyc = await prisma.kyc.findUnique({
    where: { id: kycId },
    include: {
      user: { select: { email: true, fullName: true } },
      documents: true,
    },
  });
  if (!kyc) throw new AppError('KYC not found', HttpStatus.NOT_FOUND);
  return kyc;
}

export async function approveKyc(adminId: string, kycId: string) {
  const kyc = await prisma.kyc.findUnique({ where: { id: kycId } });
  if (!kyc) throw new AppError('KYC not found', HttpStatus.NOT_FOUND);
  if (kyc.status !== 'SUBMITTED') throw new AppError('KYC is not in SUBMITTED state', HttpStatus.BAD_REQUEST);

  const updated = await prisma.kyc.update({
    where: { id: kycId },
    data: { status: 'APPROVED', approvedAt: new Date(), reviewedBy: adminId },
  });

  await prisma.auditLog.create({
    data: { userId: adminId, action: 'APPROVE_KYC', entity: 'Kyc', entityId: kycId, oldValue: { status: kyc.status }, newValue: { status: 'APPROVED' } },
  });

  return updated;
}

export async function rejectKyc(adminId: string, kycId: string, notes?: string) {
  const kyc = await prisma.kyc.findUnique({ where: { id: kycId } });
  if (!kyc) throw new AppError('KYC not found', HttpStatus.NOT_FOUND);
  if (kyc.status !== 'SUBMITTED') throw new AppError('KYC is not in SUBMITTED state', HttpStatus.BAD_REQUEST);

  const updated = await prisma.kyc.update({
    where: { id: kycId },
    data: { status: 'REJECTED', rejectedAt: new Date(), reviewedBy: adminId, notes },
  });

  await prisma.auditLog.create({
    data: { userId: adminId, action: 'REJECT_KYC', entity: 'Kyc', entityId: kycId, oldValue: { status: kyc.status }, newValue: { status: 'REJECTED', notes } },
  });

  return updated;
}

// ─── Cashouts ─────────────────────────────────────────────────────────────────

export async function listAllCashouts(query: { page?: number; limit?: number; status?: TransactionStatus; userId?: string; from?: string; to?: string }) {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.from || query.to
      ? {
          createdAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  const [total, cashouts] = await Promise.all([
    prisma.cashoutRequest.count({ where }),
    prisma.cashoutRequest.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { email: true, fullName: true } },
        bankAccount: { select: { bankName: true, accountNumber: true } },
      },
    }),
  ]);

  return paginatedResponse(cashouts, buildPaginationMeta(total, page, limit));
}

// ─── Fee Config ───────────────────────────────────────────────────────────────

export async function listFeeConfigs() {
  return prisma.feeConfig.findMany({ orderBy: { currency: 'asc' } });
}

export async function createFeeConfig(data: { currency: WalletCurrency; type: string; feePercent: number; feeFlat?: number; minFee?: number; maxFee?: number }) {
  return prisma.feeConfig.create({
    data: {
      currency: data.currency,
      type: data.type,
      feePercent: data.feePercent,
      feeFlat: data.feeFlat || 0,
      minFee: data.minFee || 0,
      maxFee: data.maxFee,
    },
  });
}

export async function updateFeeConfig(id: string, data: { feePercent?: number; feeFlat?: number; minFee?: number; maxFee?: number; isActive?: boolean }) {
  const config = await prisma.feeConfig.findUnique({ where: { id } });
  if (!config) throw new AppError('Fee config not found', HttpStatus.NOT_FOUND);
  return prisma.feeConfig.update({ where: { id }, data });
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalUsers, activeUsers, pendingKyc, totalCashouts, monthCashouts, completedCashouts] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.kyc.count({ where: { status: 'SUBMITTED' } }),
    prisma.cashoutRequest.count(),
    prisma.cashoutRequest.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.cashoutRequest.count({ where: { status: 'COMPLETED' } }),
  ]);

  const [monthVolume] = await prisma.$queryRaw<Array<{ total: string }>>`
    SELECT COALESCE(SUM("idrAmountNet"), 0)::text as total
    FROM cashout_requests
    WHERE status = 'COMPLETED' AND "createdAt" >= ${startOfMonth}
  `;

  return {
    users: { total: totalUsers, active: activeUsers },
    kyc: { pendingReview: pendingKyc },
    cashouts: {
      total: totalCashouts,
      thisMonth: monthCashouts,
      completed: completedCashouts,
      successRate: totalCashouts > 0 ? ((completedCashouts / totalCashouts) * 100).toFixed(1) : '0',
      monthVolumeIdr: monthVolume?.total || '0',
    },
  };
}
