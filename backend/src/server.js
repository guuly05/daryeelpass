import { app } from './app.js';
import { config } from './config.js';
import { prisma } from './db.js';

const server = app.listen(config.PORT, () => {
  console.info(`DaryeelPass API listening on http://localhost:${config.PORT}`);
});

async function shutdown(signal) {
  console.info(`${signal} received; closing API server.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
