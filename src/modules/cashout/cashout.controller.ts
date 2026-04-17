import { Request, Response } from 'express';
import * as cashoutService from './cashout.service';
import { successResponse } from '@/utils/response.util';
import type { TransactionStatus } from '@prisma/client';

export async function getQuoteHandler(req: Request, res: Response) {
  const quote = await cashoutService.getQuote(req.body);
  successResponse(res, quote);
}

export async function submitCashoutHandler(req: Request, res: Response) {
  const cashout = await cashoutService.submitCashout(req.user!.id, req.body);
  successResponse(res, cashout, 201, 'Cashout request submitted');
}

export async function listCashoutsHandler(req: Request, res: Response) {
  const result = await cashoutService.getCashouts(req.user!.id, {
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: req.query.status as TransactionStatus | undefined,
  });
  successResponse(res, result);
}

export async function getCashoutHandler(req: Request, res: Response) {
  const cashout = await cashoutService.getCashoutById(req.user!.id, req.params.id);
  successResponse(res, cashout);
}

export async function cancelCashoutHandler(req: Request, res: Response) {
  const cashout = await cashoutService.cancelCashout(req.user!.id, req.params.id);
  successResponse(res, cashout, 200, 'Cashout cancelled');
}
