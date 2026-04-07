import path from 'path';
import fs from 'fs';
import { prisma } from '@/config/database';
import { AppError, HttpStatus } from '@/utils/AppError';
import { env } from '@/config/env';
import type { SubmitKycDto } from './kyc.dto';
import type { KycDocumentType } from '@prisma/client';

export async function getKycStatus(userId: string) {
  const kyc = await prisma.kyc.findUnique({
    where: { userId },
    include: { documents: { select: { id: true, documentType: true, uploadedAt: true } } },
  });

  if (!kyc) throw new AppError('KYC record not found', HttpStatus.NOT_FOUND);
  return kyc;
}

export async function submitKyc(userId: string, dto: SubmitKycDto) {
  const kyc = await prisma.kyc.findUnique({ where: { userId } });

  if (!kyc) throw new AppError('KYC record not found', HttpStatus.NOT_FOUND);
  if (kyc.status === 'APPROVED') throw new AppError('KYC already approved', HttpStatus.CONFLICT);
  if (kyc.status === 'SUBMITTED') throw new AppError('KYC already submitted and under review', HttpStatus.CONFLICT);

  const updated = await prisma.kyc.update({
    where: { userId },
    data: {
      fullName: dto.fullName,
      idNumber: dto.idNumber,
      dateOfBirth: new Date(dto.dateOfBirth),
      address: dto.address,
      status: 'SUBMITTED',
    },
  });

  return updated;
}

export async function uploadDocument(userId: string, documentType: KycDocumentType, file: Express.Multer.File) {
  const kyc = await prisma.kyc.findUnique({ where: { userId } });
  if (!kyc) throw new AppError('KYC record not found', HttpStatus.NOT_FOUND);
  if (kyc.status === 'APPROVED') throw new AppError('KYC already approved', HttpStatus.CONFLICT);

  // Delete existing document of same type
  const existing = await prisma.kycDocument.findFirst({ where: { kycId: kyc.id, documentType } });
  if (existing) {
    if (env.STORAGE_PROVIDER === 'local') {
      const filePath = path.join(env.UPLOAD_DIR, existing.fileKey);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await prisma.kycDocument.delete({ where: { id: existing.id } });
  }

  const fileUrl =
    env.STORAGE_PROVIDER === 'local'
      ? `${env.APP_URL}/uploads/${file.filename}`
      : `https://${env.S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com/${file.key}`;

  const document = await prisma.kycDocument.create({
    data: {
      kycId: kyc.id,
      documentType,
      fileUrl,
      fileKey: file.filename || (file as Express.MulterS3.File).key,
      mimeType: file.mimetype,
    },
  });

  return document;
}
