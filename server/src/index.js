import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { config, aiEnabled } from './config/env.js';

async function main() {
  await connectDB();
  console.log(`[db] connected (${config.env})`);
  console.log(`[ai] ${aiEnabled ? `enabled — Groq model ${config.groqModel}` : 'disabled (no GROQ_API_KEY)'}`);

  const server = createApp().listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[api] ${signal} received, shutting down`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[api] failed to start', err);
  process.exit(1);
});
