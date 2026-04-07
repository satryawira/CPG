import { Request, Response } from 'express';
import * as adminService from './admin.service';
import { successResponse } from '@/utils/response.util';
import type { UserStatus, UserRole, KycStatus, TransactionStatus, WalletCurrency } from '@prisma/client';

export async function listUsersHandler(req: Request, res: Response) {
  const result = await adminService.listUsers({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: req.query.status as UserStatus | undefined,
    role: req.query.role as UserRole | undefined,
    search: req.query.search as string | undefined,
  });
  successResponse(res, result);
}

export async function getUserHandler(req: Request, res: Response) {
  const user = await adminService.getUserById(req.params.id);
  successResponse(res, user);
}

export async function updateUserStatusHandler(req: Request, res: Response) {
  const user = await adminService.updateUserStatus(req.user!.id, req.params.id, req.body.status as UserStatus, req.body.reason);
  successResponse(res, user);
}

export async function listKycHandler(req: Request, res: Response) {
  const result = await adminService.listKyc({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: req.query.status as KycStatus | undefined,
  });
  successResponse(res, result);
}

export async function getKycHandler(req: Request, res: Response) {
  const kyc = await adminService.getKycById(req.params.id);
  successResponse(res, kyc);
}

export async function approveKycHandler(req: Request, res: Response) {
  const kyc = await adminService.approveKyc(req.user!.id, req.params.id);
  successResponse(res, kyc, 200, 'KYC approved');
}

export async function rejectKycHandler(req: Request, res: Response) {
  const kyc = await adminService.rejectKyc(req.user!.id, req.params.id, req.body.notes);
  successResponse(res, kyc, 200, 'KYC rejected');
}

export async function listCashoutsHandler(req: Request, res: Response) {
  const result = await adminService.listAllCashouts({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: req.query.status as TransactionStatus | undefined,
    userId: req.query.userId as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
  });
  successResponse(res, result);
}

export async function listFeeConfigsHandler(req: Request, res: Response) {
  const configs = await adminService.listFeeConfigs();
  successResponse(res, configs);
}

export async function createFeeConfigHandler(req: Request, res: Response) {
  const config = await adminService.createFeeConfig({
    currency: req.body.currency as WalletCurrency,
    type: req.body.type,
    feePercent: req.body.feePercent,
    feeFlat: req.body.feeFlat,
    minFee: req.body.minFee,
    maxFee: req.body.maxFee,
  });
  successResponse(res, config, 201);
}

export async function updateFeeConfigHandler(req: Request, res: Response) {
  const config = await adminService.updateFeeConfig(req.params.id, req.body);
  successResponse(res, config);
}

export async function getDashboardStatsHandler(req: Request, res: Response) {
  const stats = await adminService.getDashboardStats();
  successResponse(res, stats);
}
