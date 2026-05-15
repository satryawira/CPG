import serverless from 'serverless-http';
import { app } from '../../src/app';
import { prisma } from '../../src/config/database';

// Reuse Prisma connection across warm invocations
let connected = false;
const serverlessHandler = serverless(app);

export const handler = async (event: object, context: object) => {
  if (!connected) {
    await prisma.$connect();
    connected = true;
  }
  return serverlessHandler(event, context);
};
