import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { submitKycSchema } from './kyc.dto';
import { kycUpload } from './kyc.upload';
import * as controller from './kyc.controller';

export const kycRoutes = Router();

kycRoutes.use(authenticate);

kycRoutes.get('/', controller.getKycHandler);
kycRoutes.post('/submit', validate(submitKycSchema), controller.submitKycHandler);
kycRoutes.post('/documents', kycUpload.single('file'), controller.uploadDocumentHandler);
