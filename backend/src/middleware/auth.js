import { prisma } from '../db.js';
import { HttpError } from '../http-error.js';

export function requireRole(role) {
  return async function authorize(req, res, next) {
    const session = req.session;
    if (!session?.userId || session.role !== role) {
      return next(new HttpError(401, 'UNAUTHENTICATED', 'Sign in is required.'));
    }

    const user = role === 'patient'
      ? await prisma.patient.findFirst({ where: { id: session.userId, active: true } })
      : await prisma.staffUser.findFirst({ where: { id: session.userId, active: true } });

    if (!user) {
      req.session = null;
      return next(new HttpError(401, 'SESSION_EXPIRED', 'Please sign in again.'));
    }

    req.user = { id: user.id, role, clinicId: user.clinicId ?? null };
    return next();
  };
}
