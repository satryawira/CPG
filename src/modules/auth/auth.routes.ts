import { Router } from 'express';
import { validate } from '@/middlewares/validate.middleware';
import { authenticate } from '@/middlewares/auth.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  verifyEmailSchema,
  updateProfileSchema,
} from './auth.dto';
import * as controller from './auth.controller';

export const authRoutes = Router();

authRoutes.post('/register', validate(registerSchema), controller.registerHandler);
authRoutes.post('/login', validate(loginSchema), controller.loginHandler);
authRoutes.post('/refresh', validate(refreshTokenSchema), controller.refreshHandler);
authRoutes.post('/logout', authenticate, controller.logoutHandler);
authRoutes.post('/verify-email', validate(verifyEmailSchema), controller.verifyEmailHandler);
authRoutes.get('/me', authenticate, controller.getMeHandler);
authRoutes.patch('/me', authenticate, validate(updateProfileSchema), controller.updateMeHandler);
