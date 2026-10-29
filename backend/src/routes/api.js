import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { prisma, withAuthContext, withUserContext } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../http-error.js';
import { createOpaqueToken, hashToken } from '../tokens.js';
import { hashPassword, verifyPassword } from '../passwords.js';
import { config } from '../config.js';

export const apiRouter = Router();
apiRouter.use('/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false }));

const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(10).max(128)
}).strict();
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) }).strict();
const requestSchema = z.object({
  serviceId: z.string().min(1).max(64),
  startsAt: z.iso.datetime({ offset: true }),
  phone: z.string().trim().min(7).max(24).regex(/^\+?[0-9 ()-]+$/)
}).strict();
const inviteSchema = z.object({ email: z.string().trim().email().max(254), clinicId: z.string().min(1).max(64) }).strict();
const statusSchema = z.object({ status: z.enum(['CONFIRMED', 'DECLINED']) }).strict();
const availabilitySchema = z.object({ serviceId: z.string().min(1).max(64), startsAt: z.iso.datetime({ offset: true }), capacity: z.number().int().min(1).max(100).default(1) }).strict();
const sessionInclude = { user: { select: { id: true, email: true, displayName: true, role: true, clinicId: true } } };

function normalizedEmail(value) { return value.trim().toLowerCase(); }

function validSystemSetupKey(candidate) {
  const configured = config.SYSTEM_SETUP_KEY;
  if (!configured || typeof candidate !== 'string') return false;
  const received = Buffer.from(candidate);
  const expected = Buffer.from(configured);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

async function openSession(req, userId) {
  const token = createOpaqueToken();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await withAuthContext((tx) => tx.loginSession.create({ data: { tokenHash: hashToken(token), userId, expiresAt } }));
  req.session = { token };
}

apiRouter.post('/auth/register', async (req, res) => {
  const input = registerSchema.parse(req.body);
  const email = normalizedEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const user = await withAuthContext((tx) => tx.user.create({
    data: { email, displayName: input.displayName, passwordHash, role: 'PATIENT' },
    select: { id: true, email: true, displayName: true, role: true, clinicId: true }
  }));
  await openSession(req, user.id);
  return res.status(201).json({ authenticated: true, user });
});

apiRouter.get('/system/setup-status', async (_req, res) => {
  if (!config.SYSTEM_SETUP_KEY) return res.json({ setupAvailable: false });
  const setupState = await withAuthContext((tx) => tx.systemSetupState.findUnique({ where: { id: 'singleton' }, select: { id: true } }));
  return res.json({ setupAvailable: !setupState });
});

apiRouter.post('/system/setup', rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }), async (req, res) => {
  const input = z.object({
    setupKey: z.string().min(1).max(256),
    email: z.string().trim().email().max(254),
    displayName: z.string().trim().min(2).max(120),
    password: z.string().min(9).max(128)
  }).strict().parse(req.body);
  if (!validSystemSetupKey(input.setupKey)) throw new HttpError(403, 'SETUP_KEY_INVALID', 'The system setup key is incorrect.');
  const passwordHash = await hashPassword(input.password);
  const user = await withAuthContext(async (tx) => {
    await tx.$queryRaw`WITH setup_lock AS MATERIALIZED (
      SELECT pg_advisory_xact_lock(4815162342)
    ) SELECT true AS locked FROM setup_lock`;
    const existing = await tx.systemSetupState.findUnique({ where: { id: 'singleton' }, select: { id: true } });
    if (existing) throw new HttpError(409, 'SYSTEM_ALREADY_SETUP', 'System admin setup has already been completed.');
    const created = await tx.user.create({
      data: { email: normalizedEmail(input.email), displayName: input.displayName, passwordHash, role: 'SYSTEM_ADMIN' },
      select: { id: true, email: true, displayName: true, role: true, clinicId: true }
    });
    await tx.systemSetupState.create({ data: { id: 'singleton', systemAdminId: created.id } });
    return created;
  });
  await openSession(req, user.id);
  return res.status(201).json({ authenticated: true, user });
});

apiRouter.post('/auth/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await withAuthContext((tx) => tx.user.findFirst({ where: { email: normalizedEmail(input.email), active: true } }));
  const valid = user ? await verifyPassword(input.password, user.passwordHash) : false;
  if (!valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  await openSession(req, user.id);
  return res.json({ authenticated: true, user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role, clinicId: user.clinicId } });
});

apiRouter.get('/auth/session', async (req, res) => {
  const token = req.session?.token;
  if (!token) return res.json({ authenticated: false });
  const session = await withAuthContext((tx) => tx.loginSession.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() }, user: { active: true } }, include: sessionInclude
  }));
  if (!session) { req.session = null; return res.json({ authenticated: false }); }
  return res.json({ authenticated: true, user: session.user });
});

apiRouter.post('/auth/logout', async (req, res) => {
  if (req.session?.token) {
    await withAuthContext((tx) => tx.loginSession.deleteMany({ where: { tokenHash: hashToken(req.session.token) } }));
  }
  req.session = null;
  return res.status(204).end();
});

apiRouter.get('/clinics', async (_req, res) => {
  const clinics = await prisma.clinic.findMany({
    where: { active: true }, orderBy: { publicName: 'asc' },
    include: { services: { where: { active: true }, orderBy: { nameKey: 'asc' } }, providers: { where: { active: true }, orderBy: { displayName: 'asc' } } }
  });
  return res.json({ data: clinics.map((clinic) => ({
    id: clinic.id, slug: clinic.slug, name: clinic.publicName ?? clinic.nameKey, locationKey: clinic.locationKey,
    address: clinic.publicAddress, phone: clinic.phone, email: clinic.email, websiteUrl: clinic.websiteUrl,
    appointmentUrl: clinic.appointmentUrl, sourceUrl: clinic.sourceUrl, verifiedAt: clinic.verifiedAt?.toISOString() ?? null,
    timezone: clinic.timezone, services: clinic.services.map(({ id, slug, nameKey }) => ({ id, slug, nameKey })),
    providers: clinic.providers.map(({ id, displayName, specialty, profileUrl, sourceUrl }) => ({ id, displayName, specialty, profileUrl, sourceUrl }))
  })) });
});

function localDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Mogadishu', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

function suggestedStartsAt(dayOffset, hour) {
  const parts = localDateParts(new Date());
  const day = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + dayOffset));
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour - 3));
}

apiRouter.get('/availability', async (req, res) => {
  const clinicId = z.string().optional().parse(req.query.clinicId);
  const serviceId = z.string().optional().parse(req.query.serviceId);
  const [services, slots] = await Promise.all([
    prisma.service.findMany({ where: { active: true, slug: { not: 'emergency' }, clinic: { active: true }, ...(clinicId ? { clinicId } : {}), ...(serviceId ? { id: serviceId } : {}) }, include: { clinic: true } }),
    prisma.appointmentSlot.findMany({ where: { active: true, source: 'staff', startsAt: { gt: new Date() }, ...(serviceId ? { serviceId } : {}), service: { active: true, clinic: { active: true, ...(clinicId ? { id: clinicId } : {}) } } }, include: { service: { include: { clinic: true } } }, orderBy: { startsAt: 'asc' }, take: 250 })
  ]);
  const data = slots.map((slot) => ({ id: slot.id, startsAt: slot.startsAt.toISOString(), source: 'staff', available: Math.max(0, slot.capacity - slot.bookedCount), serviceId: slot.serviceId, clinicId: slot.service.clinicId, serviceKey: slot.service.nameKey, clinicName: slot.service.clinic.publicName ?? slot.service.clinic.nameKey, timezone: slot.service.clinic.timezone }));
  const bookedTimes = new Set(data.map((slot) => `${slot.serviceId}:${slot.startsAt}`));
  for (const service of services) {
    for (let day = 1; day <= 7; day += 1) {
      for (const hour of [9, 11, 14]) {
        const startsAt = suggestedStartsAt(day, hour);
        if (bookedTimes.has(`${service.id}:${startsAt.toISOString()}`)) continue;
        data.push({ id: null, startsAt: startsAt.toISOString(), source: 'suggested', available: null, serviceId: service.id, clinicId: service.clinicId, serviceKey: service.nameKey, clinicName: service.clinic.publicName ?? service.clinic.nameKey, timezone: service.clinic.timezone });
      }
    }
  }
  data.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return res.json({ data });
});

apiRouter.get('/booking-requests', requireRole('patient'), async (req, res) => {
  const data = await withUserContext(req.user, (tx) => tx.bookingRequest.findMany({
    where: { userId: req.user.id }, include: { clinic: { select: { publicName: true, nameKey: true } }, service: { select: { nameKey: true } } }, orderBy: { startsAt: 'asc' }
  }));
  return res.json({ data });
});

apiRouter.post('/booking-requests', requireRole('patient'), async (req, res) => {
  const input = requestSchema.parse(req.body);
  const startsAt = new Date(input.startsAt);
  if (startsAt <= new Date() || startsAt > new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) throw new HttpError(400, 'INVALID_REQUEST_TIME', 'Choose a time within the next two weeks.');
  const service = await prisma.service.findFirst({ where: { id: input.serviceId, active: true, clinic: { active: true } }, include: { clinic: true } });
  if (!service) throw new HttpError(404, 'SERVICE_NOT_FOUND', 'That clinic service is unavailable.');
  if (service.slug === 'emergency') throw new HttpError(400, 'EMERGENCY_NOT_BOOKABLE', 'For emergency care, contact the clinic directly.');
  const generatedSet = service.slug === 'emergency' ? new Set() : new Set(Array.from({ length: 7 }, (_, index) => [9, 11, 14].map((hour) => suggestedStartsAt(index + 1, hour).toISOString())).flat());
  const slot = await prisma.appointmentSlot.findFirst({ where: { serviceId: service.id, startsAt, active: true, source: 'staff' } });
  if (!slot && !generatedSet.has(startsAt.toISOString())) throw new HttpError(400, 'INVALID_REQUEST_TIME', 'Choose one of the suggested or staff-entered times.');
  const data = await withUserContext(req.user, (tx) => tx.bookingRequest.create({
    data: { userId: req.user.id, clinicId: service.clinicId, serviceId: service.id, startsAt, phone: input.phone, source: slot ? 'staff' : 'suggested' },
    include: { clinic: { select: { publicName: true, nameKey: true } }, service: { select: { nameKey: true } } }
  }));
  return res.status(201).json({ data });
});

apiRouter.patch('/booking-requests/:id/cancel', requireRole('patient'), async (req, res) => {
  const id = z.string().min(1).max(64).parse(req.params.id);
  const result = await withUserContext(req.user, async (tx) => {
    const changed = await tx.bookingRequest.updateMany({ where: { id, userId: req.user.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (!changed.count) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Pending request not found.');
    return tx.bookingRequest.findUnique({ where: { id } });
  });
  return res.json({ data: result });
});

apiRouter.get('/staff/booking-requests', requireRole('staff', 'clinic_admin', 'system_admin'), async (req, res) => {
  const data = await withUserContext(req.user, (tx) => tx.bookingRequest.findMany({
    where: req.user.role === 'system_admin' ? {} : { clinicId: req.user.clinicId },
    include: { user: { select: { displayName: true, email: true } }, clinic: { select: { publicName: true, nameKey: true } }, service: { select: { nameKey: true } } },
    orderBy: [{ status: 'asc' }, { startsAt: 'asc' }]
  }));
  return res.json({ data });
});

apiRouter.patch('/staff/booking-requests/:id', requireRole('staff', 'clinic_admin', 'system_admin'), async (req, res) => {
  const id = z.string().min(1).max(64).parse(req.params.id);
  const { status } = statusSchema.parse(req.body);
  const result = await withUserContext(req.user, async (tx) => {
    const changed = await tx.bookingRequest.updateMany({ where: { id, status: 'PENDING', ...(req.user.role === 'system_admin' ? {} : { clinicId: req.user.clinicId }) }, data: { status } });
    if (!changed.count) throw new HttpError(404, 'REQUEST_NOT_FOUND', 'Pending request not found for this clinic.');
    return tx.bookingRequest.findUnique({ where: { id } });
  });
  return res.json({ data: result });
});

apiRouter.post('/staff/availability', requireRole('staff', 'clinic_admin', 'system_admin'), async (req, res) => {
  const input = availabilitySchema.parse(req.body);
  const startsAt = new Date(input.startsAt);
  if (startsAt <= new Date()) throw new HttpError(400, 'INVALID_AVAILABILITY_TIME', 'Availability must be in the future.');
  const service = await prisma.service.findFirst({ where: { id: input.serviceId, active: true, clinic: { active: true } } });
  if (!service || (req.user.role !== 'system_admin' && service.clinicId !== req.user.clinicId)) throw new HttpError(404, 'SERVICE_NOT_FOUND', 'Service not found for this clinic.');
  const slot = await withUserContext(req.user, (tx) => tx.appointmentSlot.create({ data: { serviceId: service.id, startsAt, capacity: input.capacity, source: 'staff' } }));
  return res.status(201).json({ data: slot });
});

apiRouter.post('/system/clinic-admin-invites', requireRole('system_admin'), async (req, res) => {
  const input = inviteSchema.parse(req.body);
  const email = normalizedEmail(input.email);
  const clinic = await prisma.clinic.findFirst({ where: { id: input.clinicId, active: true } });
  if (!clinic) throw new HttpError(404, 'CLINIC_NOT_FOUND', 'Clinic not found.');
  const token = createOpaqueToken();
  const invite = await withUserContext(req.user, (tx) => tx.staffInvite.create({ data: { email, clinicId: clinic.id, role: 'CLINIC_ADMIN', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) } }));
  const inviteUrl = `${config.FRONTEND_ORIGIN}/?staff_invite=${encodeURIComponent(token)}`;
  return res.status(201).json({ data: { id: invite.id, email, clinic: clinic.publicName ?? clinic.nameKey, expiresAt: invite.expiresAt.toISOString(), inviteUrl } });
});

apiRouter.post('/clinic-admin/staff-invites', requireRole('clinic_admin'), async (req, res) => {
  const input = z.object({ email: z.string().trim().email().max(254) }).strict().parse(req.body);
  if (!req.user.clinicId) throw new HttpError(403, 'CLINIC_NOT_ASSIGNED', 'This clinic admin has no assigned clinic.');
  const token = createOpaqueToken();
  const invite = await withUserContext(req.user, (tx) => tx.staffInvite.create({ data: {
    email: normalizedEmail(input.email), clinicId: req.user.clinicId, role: 'STAFF', tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  } }));
  const inviteUrl = `${config.FRONTEND_ORIGIN}/?staff_invite=${encodeURIComponent(token)}`;
  return res.status(201).json({ data: { id: invite.id, email: invite.email, expiresAt: invite.expiresAt.toISOString(), inviteUrl } });
});

apiRouter.get('/system/overview', requireRole('system_admin'), async (req, res) => {
  const data = await withUserContext(req.user, async (tx) => {
    const [clinics, users, requests, clinicAdmins] = await Promise.all([
      tx.clinic.findMany({ select: { id: true, publicName: true, nameKey: true, active: true, _count: { select: { users: true, bookingRequests: true } } }, orderBy: { publicName: 'asc' } }),
      tx.user.groupBy({ by: ['role'], _count: { _all: true } }),
      tx.bookingRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      tx.user.findMany({ where: { role: 'CLINIC_ADMIN' }, select: { id: true, email: true, displayName: true, active: true, clinic: { select: { publicName: true, nameKey: true } } }, orderBy: { email: 'asc' } })
    ]);
    return { clinics, users, requests, clinicAdmins };
  });
  return res.json({ data });
});

apiRouter.patch('/system/clinic-admins/:id/status', requireRole('system_admin'), async (req, res) => {
  const id = z.string().min(1).max(64).parse(req.params.id);
  const { active } = z.object({ active: z.boolean() }).strict().parse(req.body);
  const updated = await withUserContext(req.user, async (tx) => {
    const changed = await tx.user.updateMany({ where: { id, role: 'CLINIC_ADMIN' }, data: { active } });
    if (!changed.count) throw new HttpError(404, 'CLINIC_ADMIN_NOT_FOUND', 'Clinic admin not found.');
    if (!active) await tx.loginSession.deleteMany({ where: { userId: id } });
    return tx.user.findUnique({ where: { id }, select: { id: true, email: true, displayName: true, active: true } });
  });
  return res.json({ data: updated });
});

apiRouter.post('/auth/accept-staff-invite', async (req, res) => {
  const input = z.object({ token: z.string().min(20).max(256), displayName: z.string().trim().min(2).max(120), password: z.string().min(10).max(128) }).strict().parse(req.body);
  const passwordHash = await hashPassword(input.password);
  const user = await withAuthContext(async (tx) => {
    const invite = await tx.staffInvite.findFirst({ where: { tokenHash: hashToken(input.token), usedAt: null, expiresAt: { gt: new Date() } } });
    if (!invite) throw new HttpError(400, 'INVITE_INVALID', 'This staff invite is invalid or expired.');
    const created = await tx.user.create({ data: { email: normalizedEmail(invite.email), displayName: input.displayName, passwordHash, role: invite.role, clinicId: invite.clinicId }, select: { id: true, email: true, displayName: true, role: true, clinicId: true } });
    await tx.staffInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } });
    return created;
  });
  await openSession(req, user.id);
  return res.status(201).json({ authenticated: true, user });
});
