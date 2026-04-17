import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/config/database';
import { AppError, HttpStatus } from '@/utils/AppError';

export async function requireKyc(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    throw new AppError('Authentication required', HttpStatus.UNAUTHORIZED);
  }

  const kyc = await prisma.kyc.findUnique({
    where: { userId: req.user.id },
    select: { status: true },
  });

  if (!kyc || kyc.status !== 'APPROVED') {
    throw new AppError('KYC verification required to perform this action', HttpStatus.FORBIDDEN, 'KYC_REQUIRED');
  }

  next();
}
