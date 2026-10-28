import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export async function withUserContext(user, callback) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.user_id', ${user.id ?? ''}, true)`;
    await tx.$queryRaw`SELECT set_config('app.user_role', ${(user.role ?? '').toUpperCase()}, true)`;
    await tx.$queryRaw`SELECT set_config('app.clinic_id', ${user.clinicId ?? ''}, true)`;
    return callback(tx);
  });
}

export async function withAuthContext(callback) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.auth_flow', 'true', true)`;
    return callback(tx);
  });
}
