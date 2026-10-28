import { hashPassword } from '../src/passwords.js';
import { prisma, withAuthContext } from '../src/db.js';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_NAME?.trim();
  if (!email || !password || !displayName || password.length < 10) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD (at least 10 characters) for this command.');
  }
  const exists = await withAuthContext((tx) => tx.user.findFirst({ where: { role: 'ADMIN' } }));
  if (exists) throw new Error('An admin account already exists.');
  const passwordHash = await hashPassword(password);
  const admin = await withAuthContext((tx) => tx.user.create({ data: { email, displayName, passwordHash, role: 'ADMIN' } }));
  console.info(`Created local admin account ${admin.email}. Remove ADMIN_PASSWORD from the environment now.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
