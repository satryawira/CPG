import { Router, Request, Response } from 'express';
import * as webhookService from './webhook.service';
import { successResponse } from '@/utils/response.util';

export const webhookRoutes = Router();

// Raw body needed for signature verification — parse before json middleware runs
webhookRoutes.use((req, _res, next) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
});

webhookRoutes.post('/flip', async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody: Buffer }).rawBody;
  const signature = req.headers['x-callback-token'] as string || '';
  const result = await webhookService.handleFlipWebhook(rawBody, signature, req.body);
  successResponse(res, result);
});

webhookRoutes.post('/xendit', async (req: Request, res: Response) => {
  const callbackToken = req.headers['x-callback-token'] as string || '';
  const result = await webhookService.handleXenditWebhook(callbackToken, req.body);
  successResponse(res, result);
});

webhookRoutes.post('/midtrans', async (req: Request, res: Response) => {
  const rawBody = (req as Request & { rawBody: Buffer }).rawBody;
  const signatureKey = (req.body as { signature_key?: string }).signature_key || '';
  const result = await webhookService.handleMidtransWebhook(rawBody, signatureKey, req.body);
  successResponse(res, result);
});
