import { Request, Response } from 'express';
import * as kycService from './kyc.service';
import { successResponse } from '@/utils/response.util';
import { AppError, HttpStatus } from '@/utils/AppError';
import type { KycDocumentType } from '@prisma/client';

export async function getKycHandler(req: Request, res: Response) {
  const kyc = await kycService.getKycStatus(req.user!.id);
  successResponse(res, kyc);
}

export async function submitKycHandler(req: Request, res: Response) {
  const kyc = await kycService.submitKyc(req.user!.id, req.body);
  successResponse(res, kyc);
}

export async function uploadDocumentHandler(req: Request, res: Response) {
  if (!req.file) throw new AppError('No file uploaded', HttpStatus.BAD_REQUEST);

  const documentType = (req.query.type as KycDocumentType);
  const document = await kycService.uploadDocument(req.user!.id, documentType, req.file);
  successResponse(res, document, 201, 'Document uploaded successfully');
}
