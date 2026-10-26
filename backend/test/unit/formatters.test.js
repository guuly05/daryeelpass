import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAppointment } from '../../src/formatters.js';

test('formats appointment fields for the patient app without exposing identity data', () => {
  const formatted = formatAppointment({
    id: 'appointment-123',
    status: 'BOOKED',
    patientId: 'private-patient-id',
    slot: {
      startsAt: new Date('2026-10-27T06:30:00.000Z'),
      service: {
        id: 'service-123',
        slug: 'general-consult',
        nameKey: 'generalConsult',
        durationMinutes: 45,
        clinic: {
          id: 'clinic-123',
          slug: 'sample-clinic',
          nameKey: 'clinic',
          locationKey: 'clinicArea',
          timezone: 'Africa/Mogadishu'
        }
      }
    }
  });

  assert.deepEqual(formatted, {
    id: 'appointment-123',
    status: 'booked',
    startsAt: '2026-10-27T06:30:00.000Z',
    durationMinutes: 45,
    service: { id: 'service-123', slug: 'general-consult', nameKey: 'generalConsult' },
    clinic: {
      id: 'clinic-123',
      slug: 'sample-clinic',
      nameKey: 'clinic',
      locationKey: 'clinicArea',
      timezone: 'Africa/Mogadishu'
    }
  });
  assert.equal(JSON.stringify(formatted).includes('private-patient-id'), false);
});
