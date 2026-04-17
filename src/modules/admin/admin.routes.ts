import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireAdmin } from '@/middlewares/admin.middleware';
import { validate } from '@/middlewares/validate.middleware';
import {
  listUsersSchema,
  updateUserStatusSchema,
  listKycSchema,
  reviewKycSchema,
  createFeeConfigSchema,
  updateFeeConfigSchema,
  listCashoutsAdminSchema,
} from './admin.dto';
import * as controller from './admin.controller';

export const adminRoutes = Router();

adminRoutes.use(authenticate, requireAdmin);

// Dashboard
adminRoutes.get('/stats', controller.getDashboardStatsHandler);

// User management
adminRoutes.get('/users', validate(listUsersSchema), controller.listUsersHandler);
adminRoutes.get('/users/:id', controller.getUserHandler);
adminRoutes.patch('/users/:id/status', validate(updateUserStatusSchema), controller.updateUserStatusHandler);

// KYC management
adminRoutes.get('/kyc', validate(listKycSchema), controller.listKycHandler);
adminRoutes.get('/kyc/:id', controller.getKycHandler);
adminRoutes.patch('/kyc/:id/approve', controller.approveKycHandler);
adminRoutes.patch('/kyc/:id/reject', validate(reviewKycSchema), controller.rejectKycHandler);

// Cashout monitoring
adminRoutes.get('/cashouts', validate(listCashoutsAdminSchema), controller.listCashoutsHandler);

// Fee configuration
adminRoutes.get('/fees', controller.listFeeConfigsHandler);
adminRoutes.post('/fees', validate(createFeeConfigSchema), controller.createFeeConfigHandler);
adminRoutes.patch('/fees/:id', validate(updateFeeConfigSchema), controller.updateFeeConfigHandler);
