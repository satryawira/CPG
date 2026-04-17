import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { requireKyc } from '@/middlewares/kyc.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { getQuoteSchema, submitCashoutSchema, listCashoutsSchema } from './cashout.dto';
import * as controller from './cashout.controller';

export const cashoutRoutes = Router();

cashoutRoutes.use(authenticate);

cashoutRoutes.post('/quote', requireKyc, validate(getQuoteSchema), controller.getQuoteHandler);
cashoutRoutes.post('/', requireKyc, validate(submitCashoutSchema), controller.submitCashoutHandler);
cashoutRoutes.get('/', validate(listCashoutsSchema), controller.listCashoutsHandler);
cashoutRoutes.get('/:id', controller.getCashoutHandler);
cashoutRoutes.delete('/:id', controller.cancelCashoutHandler);
