import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import { prisma } from '@/config/database';
import { AppError, HttpStatus } from '@/utils/AppError';
import { getPaginationParams, buildPaginationMeta, paginatedResponse } from '@/utils/pagination.util';
import type { WalletCurrency, NetworkType, TransactionType } from '@prisma/client';
import type { CreateWalletDto, AddBankAccountDto } from './wallet.dto';

export async function getWallets(userId: string) {
  return prisma.wallet.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function createWallet(userId: string, dto: CreateWalletDto) {
  const existing = await prisma.wallet.findUnique({
    where: { userId_currency_network: { userId, currency: dto.currency as WalletCurrency, network: (dto.network ?? null) as NetworkType } },
  });

  if (existing) throw new AppError('Wallet for this currency/network already exists', HttpStatus.CONFLICT);

  const wallet = await prisma.wallet.create({
    data: {
      userId,
      currency: dto.currency as WalletCurrency,
      network: dto.network as NetworkType | undefined,
    },
  });

  return wallet;
}

export async function getWalletById(userId: string, walletId: string) {
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId, isActive: true },
  });

  if (!wallet) throw new AppError('Wallet not found', HttpStatus.NOT_FOUND);
  return wallet;
}

export async function getOrGenerateDepositAddress(userId: string, walletId: string): Promise<string> {
  const wallet = await getWalletById(userId, walletId);

  if (wallet.depositAddress) return wallet.depositAddress;

  // Generate a placeholder address (in production, integrate with actual HD wallet or exchange deposit address API)
  const address = generatePlaceholderAddress(wallet.currency, wallet.network);

  await prisma.wallet.update({ where: { id: walletId }, data: { depositAddress: address } });

  return address;
}

function generatePlaceholderAddress(currency: WalletCurrency, network: NetworkType | null): string {
  // In production: use hdkey/bitcoinjs-lib for BTC, ethers for ETH/ERC20, etc.
  // or delegate to exchange API (getDepositAddress)
  const prefix = network === 'TRC20' ? 'T' : network === 'ERC20' || network === 'BEP20' ? '0x' : '1';
  return `${prefix}${uuidv4().replace(/-/g, '').substring(0, 34)}`;
}

export async function getTransactions(userId: string, walletId: string, query: { page?: number; limit?: number; type?: TransactionType }) {
  const wallet = await getWalletById(userId, walletId);
  const { skip, take, page, limit } = getPaginationParams(query);

  const where = {
    walletId: wallet.id,
    ...(query.type ? { type: query.type } : {}),
  };

  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
  ]);

  return paginatedResponse(transactions, buildPaginationMeta(total, page, limit));
}

export async function getBankAccounts(userId: string) {
  return prisma.bankAccount.findMany({ where: { userId }, orderBy: { isDefault: 'desc' } });
}

export async function addBankAccount(userId: string, dto: AddBankAccountDto) {
  const existing = await prisma.bankAccount.findUnique({
    where: { userId_bankCode_accountNumber: { userId, bankCode: dto.bankCode, accountNumber: dto.accountNumber } },
  });
  if (existing) throw new AppError('Bank account already added', HttpStatus.CONFLICT);

  if (dto.isDefault) {
    await prisma.bankAccount.updateMany({ where: { userId }, data: { isDefault: false } });
  }

  return prisma.bankAccount.create({ data: { userId, ...dto } });
}

export async function deleteBankAccount(userId: string, bankAccountId: string) {
  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, userId } });
  if (!account) throw new AppError('Bank account not found', HttpStatus.NOT_FOUND);

  const hasPendingCashout = await prisma.cashoutRequest.findFirst({
    where: { bankAccountId, status: { in: ['PENDING', 'PROCESSING'] } },
  });
  if (hasPendingCashout) throw new AppError('Cannot delete bank account with active cashout requests', HttpStatus.CONFLICT);

  await prisma.bankAccount.delete({ where: { id: bankAccountId } });
}

// Internal: used by cashout worker
export async function lockBalance(walletId: string, amount: Decimal): Promise<void> {
  await prisma.wallet.update({
    where: { id: walletId },
    data: {
      balance: { decrement: amount.toNumber() },
      lockedBalance: { increment: amount.toNumber() },
    },
  });
}

export async function unlockBalance(walletId: string, amount: Decimal): Promise<void> {
  await prisma.wallet.update({
    where: { id: walletId },
    data: {
      balance: { increment: amount.toNumber() },
      lockedBalance: { decrement: amount.toNumber() },
    },
  });
}

export async function deductLockedBalance(walletId: string, amount: Decimal): Promise<void> {
  await prisma.wallet.update({
    where: { id: walletId },
    data: { lockedBalance: { decrement: amount.toNumber() } },
  });
}
