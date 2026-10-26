import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const clinicId = 'clinic-demo-mogadishu';
const patientId = 'patient-demo-ayaan';
const staffId = 'staff-demo-reception';

function localDay(offset) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Mogadishu', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
    key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  };
}

function mogadishuTime(date, clock) {
  const [hours, minutes] = clock.split(':').map(Number);
  return new Date(Date.UTC(date.year, date.month - 1, date.day, hours - 3, minutes));
}

async function main() {
  await prisma.clinic.upsert({
    where: { id: clinicId },
    update: { active: true },
    create: {
      id: clinicId,
      slug: 'sample-mogadishu-clinic',
      nameKey: 'clinic',
      locationKey: 'clinicArea',
      timezone: 'Africa/Mogadishu'
    }
  });

  const services = [];
  for (const service of [
    { slug: 'general-consult', nameKey: 'generalConsult', durationMinutes: 45 },
    { slug: 'nutrition-consult', nameKey: 'nutritionConsult', durationMinutes: 45 }
  ]) {
    const record = await prisma.service.upsert({
      where: { clinicId_slug: { clinicId, slug: service.slug } },
      update: { nameKey: service.nameKey, durationMinutes: service.durationMinutes, active: true },
      create: { clinicId, ...service }
    });
    services.push(record);
  }

  await prisma.patient.upsert({
    where: { id: patientId },
    update: { displayName: 'Ayaan', active: true },
    create: { id: patientId, displayName: 'Ayaan' }
  });

  await prisma.staffUser.upsert({
    where: { id: staffId },
    update: { displayName: 'Demo Reception', active: true, clinicId },
    create: { id: staffId, clinicId, displayName: 'Demo Reception' }
  });

  const clocks = ['09:30', '10:15', '11:00', '14:00'];
  const slotIds = [];
  for (let offset = 1; offset <= 7; offset += 1) {
    const date = localDay(offset);
    for (const service of services) {
      for (const [index, clock] of clocks.entries()) {
        const id = `slot-${service.slug}-${date.key}-${clock.replace(':', '')}`;
        const isDemoVisit = offset === 1 && service.slug === 'general-consult' && index === 0;
        const slot = await prisma.appointmentSlot.upsert({
          where: { id },
          update: { active: true },
          create: {
            id,
            serviceId: service.id,
            startsAt: mogadishuTime(date, clock),
            capacity: 8,
            bookedCount: isDemoVisit ? 1 : 0
          }
        });
        if (isDemoVisit) slotIds.push(slot.id);
      }
    }
  }

  await prisma.appointment.upsert({
    where: { id: 'appointment-demo-ayaan' },
    update: { patientId, slotId: slotIds[0], status: 'BOOKED' },
    create: { id: 'appointment-demo-ayaan', patientId, slotId: slotIds[0], status: 'BOOKED' }
  });

  console.info('Seeded the synthetic DaryeelPass clinic, slots, patient, staff, and sample appointment.');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
