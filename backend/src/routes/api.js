import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../http-error.js';
import { appointmentDetails, formatAppointment } from '../formatters.js';
import { createOpaqueToken, hashToken } from '../tokens.js';
import { createPkcePair, loadEsignetClient, makePrivateKeyAssertion, verifyEsignetJwt } from '../esignet.js';
import { randomBytes } from 'node:crypto';

export const apiRouter = Router();

const bookingSchema = z.object({ slotId: z.string().min(1).max(64) }).strict();
const tokenSchema = z.object({ token: z.string().min(20).max(256) }).strict();

apiRouter.get('/auth/session', async (req, res) => {
  if (!req.session?.userId || !req.session?.role) {
    return res.json({ authenticated: false, mode: config.demoMode ? 'demo' : 'esignet' });
  }

  const user = req.session.role === 'patient'
    ? await prisma.patient.findFirst({ where: { id: req.session.userId, active: true }, select: { id: true, displayName: true } })
    : await prisma.staffUser.findFirst({ where: { id: req.session.userId, active: true }, select: { id: true, displayName: true } });

  if (!user) {
    req.session = null;
    return res.json({ authenticated: false, mode: config.demoMode ? 'demo' : 'esignet' });
  }

  return res.json({ authenticated: true, role: req.session.role, user });
});

apiRouter.post('/auth/demo/patient', async (req, res, next) => {
  if (!config.demoMode || config.isProduction) return next(new HttpError(404, 'NOT_FOUND', 'The requested route was not found.'));
  const patient = await prisma.patient.findFirst({ where: { id: 'patient-demo-ayaan', active: true }, select: { id: true, displayName: true } });
  if (!patient) return next(new HttpError(503, 'DEMO_NOT_SEEDED', 'Run the database seed before using demo sign-in.'));
  req.session = { userId: patient.id, role: 'patient' };
  return res.json({ authenticated: true, mode: 'demo', role: 'patient', user: patient });
});

apiRouter.post('/auth/demo/staff', async (req, res, next) => {
  if (!config.demoMode || config.isProduction) return next(new HttpError(404, 'NOT_FOUND', 'The requested route was not found.'));
  const staff = await prisma.staffUser.findFirst({ where: { id: 'staff-demo-reception', active: true }, select: { id: true, displayName: true } });
  if (!staff) return next(new HttpError(503, 'DEMO_NOT_SEEDED', 'Run the database seed before using demo sign-in.'));
  req.session = { userId: staff.id, role: 'staff' };
  return res.json({ authenticated: true, mode: 'demo', role: 'staff', user: staff });
});

apiRouter.post('/auth/logout', (req, res) => {
  req.session = null;
  return res.status(204).end();
});

apiRouter.get('/clinics', async (_req, res) => {
  const clinics = await prisma.clinic.findMany({
    where: { active: true },
    orderBy: { nameKey: 'asc' },
    include: { services: { where: { active: true }, orderBy: { nameKey: 'asc' } } }
  });
  return res.json({ data: clinics.map((clinic) => ({
    id: clinic.id,
    slug: clinic.slug,
    nameKey: clinic.nameKey,
    locationKey: clinic.locationKey,
    timezone: clinic.timezone,
    services: clinic.services.map(({ id, slug, nameKey, durationMinutes }) => ({ id, slug, nameKey, durationMinutes }))
  })) });
});

apiRouter.get('/slots', async (req, res) => {
  const query = z.object({
    serviceId: z.string().optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional()
  }).parse(req.query);
  const from = query.from ? new Date(query.from) : new Date();
  const to = query.to ? new Date(query.to) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  if (from >= to) throw new HttpError(400, 'INVALID_DATE_RANGE', 'The end date must be later than the start date.');

  const slots = await prisma.appointmentSlot.findMany({
    where: {
      active: true,
      startsAt: { gte: from, lt: to },
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      service: { active: true, clinic: { active: true } }
    },
    orderBy: { startsAt: 'asc' },
    include: { service: { include: { clinic: true } } }
  });
  return res.json({ data: slots.filter((slot) => slot.bookedCount < slot.capacity).map((slot) => ({
    id: slot.id,
    startsAt: slot.startsAt.toISOString(),
    available: Math.max(0, slot.capacity - slot.bookedCount),
    service: { id: slot.service.id, slug: slot.service.slug, nameKey: slot.service.nameKey, durationMinutes: slot.service.durationMinutes },
    clinic: { id: slot.service.clinic.id, slug: slot.service.clinic.slug, nameKey: slot.service.clinic.nameKey, locationKey: slot.service.clinic.locationKey, timezone: slot.service.clinic.timezone }
  })) });
});

apiRouter.get('/appointments', requireRole('patient'), async (req, res) => {
  const appointments = await prisma.appointment.findMany({
    where: { patientId: req.user.id, status: { in: ['BOOKED', 'CHECKED_IN'] } },
    orderBy: { slot: { startsAt: 'asc' } },
    include: appointmentDetails
  });
  return res.json({ data: appointments.map(formatAppointment) });
});

apiRouter.post('/appointments', requireRole('patient'), async (req, res) => {
  const { slotId } = bookingSchema.parse(req.body);
  const appointment = await prisma.$transaction(async (tx) => {
    const reserved = await tx.$queryRaw`
      UPDATE appointment_slots
      SET booked_count = booked_count + 1, updated_at = NOW()
      WHERE id = ${slotId} AND active = TRUE AND booked_count < capacity
      RETURNING id
    `;
    if (reserved.length === 0) throw new HttpError(409, 'SLOT_UNAVAILABLE', 'That time is no longer available. Choose another time.');
    return tx.appointment.create({
      data: { patientId: req.user.id, slotId },
      include: appointmentDetails
    });
  });
  return res.status(201).json({ data: formatAppointment(appointment) });
});

apiRouter.patch('/appointments/:appointmentId/cancel', requireRole('patient'), async (req, res) => {
  const { appointmentId } = z.object({ appointmentId: z.string().min(1).max(64) }).parse(req.params);
  const appointment = await prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({ where: { id: appointmentId, patientId: req.user.id } });
    if (!existing) throw new HttpError(404, 'APPOINTMENT_NOT_FOUND', 'Appointment not found.');
    if (existing.status !== 'BOOKED') throw new HttpError(409, 'APPOINTMENT_NOT_CANCELLABLE', 'This appointment can no longer be cancelled.');

    const changed = await tx.appointment.updateMany({
      where: { id: appointmentId, patientId: req.user.id, status: 'BOOKED' },
      data: { status: 'CANCELLED' }
    });
    if (changed.count !== 1) throw new HttpError(409, 'APPOINTMENT_NOT_CANCELLABLE', 'This appointment can no longer be cancelled.');
    await tx.appointmentSlot.update({ where: { id: existing.slotId }, data: { bookedCount: { decrement: 1 } } });
    await tx.checkInToken.updateMany({ where: { appointmentId, usedAt: null }, data: { usedAt: new Date() } });
    return tx.appointment.findUnique({ where: { id: appointmentId }, include: appointmentDetails });
  });
  return res.json({ data: formatAppointment(appointment) });
});

apiRouter.post('/appointments/:appointmentId/pass', requireRole('patient'), async (req, res) => {
  const { appointmentId } = z.object({ appointmentId: z.string().min(1).max(64) }).parse(req.params);
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, patientId: req.user.id, status: 'BOOKED' } });
  if (!appointment) throw new HttpError(404, 'APPOINTMENT_NOT_FOUND', 'A bookable appointment was not found.');

  const now = new Date();
  await prisma.checkInToken.updateMany({ where: { appointmentId, usedAt: null }, data: { usedAt: now } });
  const token = createOpaqueToken();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  await prisma.checkInToken.create({ data: { tokenHash: hashToken(token), appointmentId, expiresAt } });
  return res.status(201).json({ data: { token, expiresAt: expiresAt.toISOString() } });
});

apiRouter.post('/staff/check-ins/verify', requireRole('staff'), async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  const tokenHash = hashToken(token);
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.checkInToken.findUnique({
      where: { tokenHash },
      include: { appointment: { include: { patient: true, ...appointmentDetails } } }
    });
    if (!record || record.usedAt || record.expiresAt <= now || record.appointment.status !== 'BOOKED') {
      throw new HttpError(400, 'INVALID_CHECK_IN_TOKEN', 'This check-in code is invalid, expired, or already used.');
    }
    if (record.appointment.slot.service.clinicId !== req.user.clinicId) {
      throw new HttpError(403, 'WRONG_CLINIC', 'This appointment is for a different clinic.');
    }

    const consumed = await tx.checkInToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now }
    });
    if (consumed.count !== 1) throw new HttpError(400, 'INVALID_CHECK_IN_TOKEN', 'This check-in code is invalid, expired, or already used.');

    const updated = await tx.appointment.updateMany({
      where: { id: record.appointmentId, status: 'BOOKED' },
      data: { status: 'CHECKED_IN' }
    });
    if (updated.count !== 1) throw new HttpError(409, 'APPOINTMENT_ALREADY_UPDATED', 'This appointment has already been checked in.');

    await tx.auditEvent.create({ data: {
      actorRole: 'staff',
      actorId: req.user.id,
      eventType: 'appointment.checked_in',
      resourceType: 'appointment',
      resourceId: record.appointmentId
    } });
    return record.appointment;
  });

  return res.json({ data: {
    appointmentId: result.id,
    patientDisplayName: result.patient.displayName,
    serviceKey: result.slot.service.nameKey,
    clinicKey: result.slot.service.clinic.nameKey,
    startsAt: result.slot.startsAt.toISOString(),
    status: 'checked_in'
  } });
});

apiRouter.get('/staff/queue', requireRole('staff'), async (req, res) => {
  const query = z.object({ date: z.iso.date().optional() }).parse(req.query);
  const date = query.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Mogadishu' }).format(new Date());
  const start = new Date(`${date}T00:00:00+03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const appointments = await prisma.appointment.findMany({
    where: {
      status: 'CHECKED_IN',
      slot: { startsAt: { gte: start, lt: end }, service: { clinicId: req.user.clinicId } }
    },
    orderBy: { slot: { startsAt: 'asc' } },
    include: { patient: { select: { displayName: true } }, ...appointmentDetails }
  });
  return res.json({ data: appointments.map((appointment) => ({
    appointmentId: appointment.id,
    patientDisplayName: appointment.patient.displayName,
    serviceKey: appointment.slot.service.nameKey,
    startsAt: appointment.slot.startsAt.toISOString(),
    status: 'checked_in'
  })) });
});

apiRouter.get('/auth/esignet', async (req, res) => {
  const client = await loadEsignetClient();
  const { verifier, challenge } = createPkcePair();
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  req.session.oidcTransaction = { state, nonce, verifier, createdAt: Date.now() };

  const authorization = new URL(client.metadata.authorization_endpoint);
  authorization.searchParams.set('client_id', client.clientId);
  authorization.searchParams.set('redirect_uri', client.redirectUri);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('scope', 'openid profile');
  authorization.searchParams.set('state', state);
  authorization.searchParams.set('nonce', nonce);
  authorization.searchParams.set('code_challenge', challenge);
  authorization.searchParams.set('code_challenge_method', 'S256');
  return res.redirect(authorization.toString());
});

apiRouter.get('/auth/esignet/callback', async (req, res) => {
  const frontendUrl = new URL(config.FRONTEND_ORIGIN);
  const fail = (reason) => {
    req.session = null;
    frontendUrl.searchParams.set('auth_error', reason);
    return res.redirect(frontendUrl.toString());
  };
  if (req.query.error) return fail('provider');

  const transaction = req.session?.oidcTransaction;
  const returnedState = typeof req.query.state === 'string' ? req.query.state : '';
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  if (!transaction || Date.now() - transaction.createdAt > 10 * 60 * 1000 || !returnedState || returnedState !== transaction.state || !code) {
    return fail('invalid_response');
  }

  const client = await loadEsignetClient();
  const assertion = makePrivateKeyAssertion({ clientId: client.clientId, audience: client.metadata.token_endpoint, privateKey: client.privateKey, kid: client.kid });
  const tokenResponse = await fetch(client.metadata.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: client.clientId,
      redirect_uri: client.redirectUri,
      code_verifier: transaction.verifier,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: assertion
    })
  });
  if (!tokenResponse.ok) {
    const tokenError = await tokenResponse.json().catch(() => ({}));
    console.warn('eSignet token exchange rejected the request', {
      status: tokenResponse.status,
      error: tokenError.error,
      description: tokenError.error_description
    });
    return fail('token_exchange');
  }
  const tokenSet = await tokenResponse.json();
  if (typeof tokenSet.id_token !== 'string' || typeof tokenSet.access_token !== 'string') return fail('missing_token');

  const idClaims = await verifyEsignetJwt(tokenSet.id_token, {
    client,
    expectedAudience: client.clientId,
    expectedNonce: transaction.nonce
  });
  const userInfoResponse = await fetch(client.metadata.userinfo_endpoint, {
    headers: { authorization: `Bearer ${tokenSet.access_token}`, accept: 'application/jwt' }
  });
  if (!userInfoResponse.ok) return fail('userinfo');
  const userInfoClaims = await verifyEsignetJwt(await userInfoResponse.text(), { client, userInfo: true });
  if (userInfoClaims.sub !== idClaims.sub) return fail('subject_mismatch');

  const nameClaim = userInfoClaims.name ?? userInfoClaims['name#en'];
  const displayName = typeof nameClaim === 'string' && nameClaim.trim()
    ? nameClaim.trim().slice(0, 120)
    : `eSignet patient ${idClaims.sub.slice(0, 8)}`;
  const identity = await prisma.identityLink.upsert({
    where: { issuer_subject: { issuer: client.issuer, subject: idClaims.sub } },
    create: {
      issuer: client.issuer,
      subject: idClaims.sub,
      patient: { create: { displayName } }
    },
    update: {},
    include: { patient: { select: { id: true } } }
  });

  req.session = { userId: identity.patient.id, role: 'patient' };
  frontendUrl.searchParams.set('auth', 'success');
  return res.redirect(frontendUrl.toString());
});
