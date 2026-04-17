import { Router } from 'express';
import { authenticate } from '@/middlewares/auth.middleware';
import { validate } from '@/middlewares/validate.middleware';
import { createWalletSchema, addBankAccountSchema, listTransactionsSchema } from './wallet.dto';
import * as controller from './wallet.controller';

export const walletRoutes = Router();

walletRoutes.use(authenticate);

walletRoutes.get('/', controller.getWalletsHandler);
walletRoutes.post('/', validate(createWalletSchema), controller.createWalletHandler);
walletRoutes.get('/bank-accounts', controller.getBankAccountsHandler);
walletRoutes.post('/bank-accounts', validate(addBankAccountSchema), controller.addBankAccountHandler);
walletRoutes.delete('/bank-accounts/:id', controller.deleteBankAccountHandler);
walletRoutes.get('/:walletId', controller.getWalletHandler);
walletRoutes.get('/:walletId/address', controller.getDepositAddressHandler);
walletRoutes.get('/:walletId/transactions', validate(listTransactionsSchema), controller.getTransactionsHandler);
