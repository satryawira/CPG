import serverless from 'serverless-http';
import { app } from '../../src/app';
import { prisma } from '../../src/config/database';

// Reuse Prisma connection across warm invocations
let connected = false;
const handler = serverless(app);

export const main = async (event: object, context: object) => {
  if (!connected) {
    await prisma.$connect();
    connected = true;
  }
  return handler(event, context);
};
