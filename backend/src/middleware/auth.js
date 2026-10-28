import { prisma, withAuthContext } from '../db.js';
import { hashToken } from '../tokens.js';
import { HttpError } from '../http-error.js';

export function requireRole(...roles) {
  return async function authorize(req, _res, next) {
    try {
      const token = req.session?.token;
      if (!token) return next(new HttpError(401, 'UNAUTHENTICATED', 'Sign in is required.'));
      const session = await withAuthContext((tx) => tx.loginSession.findFirst({
        where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() }, user: { active: true } },
        include: { user: { select: { id: true, email: true, displayName: true, role: true, clinicId: true } } }
      }));
      if (!session || !roles.includes(session.user.role.toLowerCase())) {
        if (!session) req.session = null;
        return next(new HttpError(session ? 403 : 401, session ? 'FORBIDDEN' : 'SESSION_EXPIRED', session ? 'You do not have access to this action.' : 'Please sign in again.'));
      }
      req.user = { ...session.user, role: session.user.role.toLowerCase() };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}
