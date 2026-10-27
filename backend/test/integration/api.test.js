import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../../src/app.js';
import { prisma } from '../../src/db.js';

const origin = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';
let server;
let baseUrl;
const bookedAppointments = new Set();

before(async () => {
  await prisma.$connect();
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  for (const appointmentId of bookedAppointments) {
    const appointment = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) continue;
    await prisma.$transaction(async (tx) => {
      if (appointment.status === 'BOOKED' || appointment.status === 'CHECKED_IN') {
        await tx.appointmentSlot.update({ where: { id: appointment.slotId }, data: { bookedCount: { decrement: 1 } } });
      }
      await tx.appointment.delete({ where: { id: appointmentId } });
    });
  }
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

async function signIn(role) {
  const { response, data } = await request(`/api/v1/auth/demo/${role}`, { method: 'POST', body: {} });
  assert.equal(response.status, 200, JSON.stringify(data));
  const setCookie = response.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; ');
  assert.ok(setCookie.includes('daryeelpass.session='));
  return setCookie;
}

async function availableSlot(serviceSlug) {
  const slots = await prisma.appointmentSlot.findMany({
    where: { active: true, startsAt: { gt: new Date() }, service: { slug: serviceSlug } },
    orderBy: { startsAt: 'asc' }
  });
  const slot = slots.find(({ capacity, bookedCount }) => bookedCount < capacity);
  assert.ok(slot, `Expected a future available ${serviceSlug} slot. Run the demo seed first.`);
  return slot;
}

test('requires a patient session and rejects disallowed browser origins', async () => {
  const unauthenticated = await request('/api/v1/appointments');
  assert.equal(unauthenticated.response.status, 401);
  assert.equal(unauthenticated.data.error.code, 'UNAUTHENTICATED');

  const forbiddenOrigin = await request('/api/v1/clinics', { requestOrigin: 'https://untrusted.example' });
  assert.equal(forbiddenOrigin.response.status, 403);
  assert.equal(forbiddenOrigin.data.error.code, 'ORIGIN_NOT_ALLOWED');
});

test('lists sourced Hargeisa clinic details without claiming unconnected schedules', async () => {
  const clinics = await request('/api/v1/clinics');
  assert.equal(clinics.response.status, 200);
  const alIhsan = clinics.data.data.find((clinic) => clinic.slug === 'al-ihsan-specialist-hospital');
  assert.ok(alIhsan);
  assert.equal(alIhsan.name, 'Al Ihsan Specialist Hospital');
  assert.ok(alIhsan.sourceUrl);
  assert.ok(alIhsan.services.some((service) => service.nameKey === 'cardiology'));
  assert.ok(alIhsan.providers.some((provider) => provider.displayName === 'Dr Mohamed Mohamud (Dr Shiine)'));
  assert.ok(alIhsan.providers.every((provider) => provider.sourceUrl));

  const slots = await request('/api/v1/slots');
  assert.equal(slots.response.status, 200);
  assert.deepEqual(slots.data.data, []);
});

test('books, cancels once, and releases the reserved slot capacity', async () => {
  const cookie = await signIn('patient');
  const slot = await availableSlot('nutrition-consult');
  const booked = await request('/api/v1/appointments', { method: 'POST', cookie, body: { slotId: slot.id } });
  assert.equal(booked.response.status, 201, JSON.stringify(booked.data));
  const appointmentId = booked.data.data.id;
  bookedAppointments.add(appointmentId);

  const cancelled = await request(`/api/v1/appointments/${appointmentId}/cancel`, { method: 'PATCH', cookie });
  assert.equal(cancelled.response.status, 200);
  assert.equal(cancelled.data.data.status, 'cancelled');

  const repeated = await request(`/api/v1/appointments/${appointmentId}/cancel`, { method: 'PATCH', cookie });
  assert.equal(repeated.response.status, 409);
  assert.equal(repeated.data.error.code, 'APPOINTMENT_NOT_CANCELLABLE');

  const refreshedSlot = await prisma.appointmentSlot.findUnique({ where: { id: slot.id } });
  assert.equal(refreshedSlot.bookedCount, slot.bookedCount);
});

test('issues a short-lived pass and allows staff to check in only once', async () => {
  const patientCookie = await signIn('patient');
  const staffCookie = await signIn('staff');
  const slot = await availableSlot('general-consult');
  const booked = await request('/api/v1/appointments', { method: 'POST', cookie: patientCookie, body: { slotId: slot.id } });
  assert.equal(booked.response.status, 201, JSON.stringify(booked.data));
  const appointmentId = booked.data.data.id;
  bookedAppointments.add(appointmentId);

  const pass = await request(`/api/v1/appointments/${appointmentId}/pass`, { method: 'POST', cookie: patientCookie, body: {} });
  assert.equal(pass.response.status, 201);
  assert.ok(pass.data.data.token);
  assert.ok(Date.parse(pass.data.data.expiresAt) > Date.now());

  const checkedIn = await request('/api/v1/staff/check-ins/verify', {
    method: 'POST', cookie: staffCookie, body: { token: pass.data.data.token }
  });
  assert.equal(checkedIn.response.status, 200, JSON.stringify(checkedIn.data));
  assert.equal(checkedIn.data.data.status, 'checked_in');
  assert.equal(checkedIn.data.data.patientDisplayName, 'Ayaan');

  const reused = await request('/api/v1/staff/check-ins/verify', {
    method: 'POST', cookie: staffCookie, body: { token: pass.data.data.token }
  });
  assert.equal(reused.response.status, 400);
  assert.equal(reused.data.error.code, 'INVALID_CHECK_IN_TOKEN');

  const dateParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Mogadishu', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(booked.data.data.startsAt));
  const dateValues = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const date = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;
  const queue = await request(`/api/v1/staff/queue?date=${date}`, { cookie: staffCookie });
  assert.equal(queue.response.status, 200);
  assert.ok(queue.data.data.some((item) => item.appointmentId === appointmentId));
});
