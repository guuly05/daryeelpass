import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
const setupKey = process.env.SYSTEM_SETUP_KEY;
let server;
let baseUrl;

before(async () => {
  assert.ok(setupKey, 'Set SYSTEM_SETUP_KEY for integration tests.');
  await prisma.$connect();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await prisma.$disconnect();
});

async function request(path, { method = 'GET', body, cookie, requestOrigin = origin } = {}) {
  const headers = { origin: requestOrigin };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  return { response, data: text ? JSON.parse(text) : null };
}

function cookieFrom(response) {
  return response.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
}

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
}

async function registerPatient() {
  const { response, data } = await request('/api/v1/auth/register', {
    method: 'POST',
    body: { email: uniqueEmail('patient'), displayName: 'Test Patient', password: 'patient-test-password-123' }
  });
  assert.equal(response.status, 201, JSON.stringify(data));
  assert.equal(data.user.role, 'PATIENT');
  return { user: data.user, cookie: cookieFrom(response) };
}

test('requires a patient session for booking requests and rejects disallowed browser origins', async () => {
  const unauthenticated = await request('/api/v1/booking-requests');
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.data.error.code, 'UNAUTHENTICATED');

  const forbiddenOrigin = await request('/api/v1/clinics', { requestOrigin: 'https://untrusted.example' });
  assert.equal(forbiddenOrigin.response.status, 403);
  assert.equal(forbiddenOrigin.data.error.code, 'ORIGIN_NOT_ALLOWED');
});

test('lists sourced clinic details and clearly distinguishes suggested availability', async () => {
  const clinics = await request('/api/v1/clinics');
  assert.equal(clinics.response.status, 200);
  assert.ok(clinics.data.data.length > 0);
  assert.ok(clinics.data.data.every((clinic) => clinic.sourceUrl));

  const availability = await request('/api/v1/availability');
  assert.equal(availability.response.status, 200);
  assert.ok(availability.data.data.length > 0);
  assert.ok(availability.data.data.every((slot) => ['suggested', 'staff'].includes(slot.source)));
  assert.ok(availability.data.data.some((slot) => slot.source === 'suggested' && slot.available === null));
});

test('registers a patient and creates and cancels an in-app booking request', async () => {
  const { cookie } = await registerPatient();
  const availability = await request('/api/v1/availability');
  const slot = availability.data.data.find((candidate) => candidate.source === 'suggested');
  assert.ok(slot, 'The clinic seed should provide suggested times.');

  const created = await request('/api/v1/booking-requests', {
    method: 'POST', cookie,
    body: { serviceId: slot.serviceId, startsAt: slot.startsAt, phone: '+252 63 1234567' }
  });
  assert.equal(created.response.status, 201, JSON.stringify(created.data));
  assert.equal(created.data.data.status, 'PENDING');
  assert.equal(created.data.data.source, 'suggested');
  assert.equal(created.data.data.phone, '+252 63 1234567');

  const patientCannotReadStaffQueue = await request('/api/v1/staff/booking-requests', { cookie });
  assert.equal(patientCannotReadStaffQueue.response.status, 403);
  assert.equal(patientCannotReadStaffQueue.data.error.code, 'FORBIDDEN');

  const patientCannotChangeRequestStatus = await request(`/api/v1/staff/booking-requests/${created.data.data.id}`, {
    method: 'PATCH', cookie, body: { status: 'CONFIRMED' }
  });
  assert.equal(patientCannotChangeRequestStatus.response.status, 403);
  assert.equal(patientCannotChangeRequestStatus.data.error.code, 'FORBIDDEN');

  const listed = await request('/api/v1/booking-requests', { cookie });
  assert.ok(listed.data.data.some((item) => item.id === created.data.data.id));

  const cancelled = await request(`/api/v1/booking-requests/${created.data.data.id}/cancel`, { method: 'PATCH', cookie });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.data.data.status, 'CANCELLED');
});

test('creates the system admin once and allows system-wide clinic admin management', async () => {
  const statusBefore = await request('/api/v1/system/setup-status');
  assert.equal(statusBefore.response.status, 200);
  assert.equal(statusBefore.data.setupAvailable, true);

  const invalidKey = await request('/api/v1/system/setup', {
    method: 'POST', body: { setupKey: 'incorrect-setup-key', email: uniqueEmail('sysadmin'), displayName: 'Test Admin', password: 'system-admin-password-123' }
  });
  assert.equal(invalidKey.response.status, 403);
  assert.equal(invalidKey.data.error.code, 'SETUP_KEY_INVALID');

  const createdAdmin = await request('/api/v1/system/setup', {
    method: 'POST', body: { setupKey, email: uniqueEmail('sysadmin'), displayName: 'Test System Admin', password: 'system-admin-password-123' }
  });
  assert.equal(createdAdmin.response.status, 201, JSON.stringify(createdAdmin.data));
  assert.equal(createdAdmin.data.user.role, 'SYSTEM_ADMIN');
  const adminCookie = cookieFrom(createdAdmin.response);

  const statusAfter = await request('/api/v1/system/setup-status');
  assert.equal(statusAfter.data.setupAvailable, false);
  const repeatedSetup = await request('/api/v1/system/setup', {
    method: 'POST', body: { setupKey, email: uniqueEmail('second-admin'), displayName: 'Second Admin', password: 'system-admin-password-456' }
  });
  assert.equal(repeatedSetup.response.status, 409);
  assert.equal(repeatedSetup.data.error.code, 'SYSTEM_ALREADY_SETUP');

  const overview = await request('/api/v1/system/overview', { cookie: adminCookie });
  assert.equal(overview.response.status, 200, JSON.stringify(overview.data));
  assert.ok(overview.data.data.clinics.length > 0);
  const clinic = overview.data.data.clinics[0];

  const invited = await request('/api/v1/system/clinic-admin-invites', {
    method: 'POST', cookie: adminCookie,
    body: { email: uniqueEmail('clinic-admin'), clinicId: clinic.id }
  });
  assert.equal(invited.response.status, 201, JSON.stringify(invited.data));
  const inviteToken = new URL(invited.data.data.inviteUrl).searchParams.get('staff_invite');
  assert.ok(inviteToken);

  const accepted = await request('/api/v1/auth/accept-staff-invite', {
    method: 'POST', body: { token: inviteToken, displayName: 'Test Clinic Admin', password: 'clinic-admin-password-123' }
  });
  assert.equal(accepted.response.status, 201, JSON.stringify(accepted.data));
  assert.equal(accepted.data.user.role, 'CLINIC_ADMIN');

  const clinicAdminRequests = await request('/api/v1/staff/booking-requests', { cookie: cookieFrom(accepted.response) });
  assert.equal(clinicAdminRequests.response.status, 200, JSON.stringify(clinicAdminRequests.data));
});
