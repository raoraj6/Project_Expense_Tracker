/**
 * Runs the API against an ephemeral in-memory MongoDB — no local mongod or
 * Docker needed. Seeds the demo account on boot. Data is discarded on exit.
 *
 *   npm run dev:mem
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongo = await MongoMemoryServer.create();

process.env.MONGO_URI = mongo.getUri('expense_tracker');
process.env.JWT_SECRET ??= 'in-memory-dev-secret';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';

console.log(`[mem-mongo] ${process.env.MONGO_URI}`);

if (process.env.SEED !== 'false') {
  const { seed } = await import('../src/utils/seed.js');
  await seed();
}

await import('../src/index.js');

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    await mongo.stop();
  });
}
