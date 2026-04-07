import { Request, Response } from 'express';
import * as walletService from './wallet.service';
import { successResponse } from '@/utils/response.util';
import type { TransactionType } from '@prisma/client';

export async function getWalletsHandler(req: Request, res: Response) {
  const wallets = await walletService.getWallets(req.user!.id);
  successResponse(res, wallets);
}

export async function createWalletHandler(req: Request, res: Response) {
  const wallet = await walletService.createWallet(req.user!.id, req.body);
  successResponse(res, wallet, 201);
}

export async function getWalletHandler(req: Request, res: Response) {
  const wallet = await walletService.getWalletById(req.user!.id, req.params.walletId);
  successResponse(res, wallet);
}

export async function getDepositAddressHandler(req: Request, res: Response) {
  const address = await walletService.getOrGenerateDepositAddress(req.user!.id, req.params.walletId);
  successResponse(res, { address });
}

export async function getTransactionsHandler(req: Request, res: Response) {
  const result = await walletService.getTransactions(req.user!.id, req.params.walletId, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    type: req.query.type as TransactionType | undefined,
  });
  successResponse(res, result);
}

export async function getBankAccountsHandler(req: Request, res: Response) {
  const accounts = await walletService.getBankAccounts(req.user!.id);
  successResponse(res, accounts);
}

export async function addBankAccountHandler(req: Request, res: Response) {
  const account = await walletService.addBankAccount(req.user!.id, req.body);
  successResponse(res, account, 201);
}

export async function deleteBankAccountHandler(req: Request, res: Response) {
  await walletService.deleteBankAccount(req.user!.id, req.params.id);
  successResponse(res, null, 200, 'Bank account deleted');
}
