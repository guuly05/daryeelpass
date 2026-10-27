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
    update: { active: false },
    create: {
      id: clinicId,
      slug: 'sample-mogadishu-clinic',
      nameKey: 'clinic',
      locationKey: 'clinicArea',
      timezone: 'Africa/Mogadishu',
      active: false
    }
  });

  const clinicRecords = [
    {
      slug: 'nasrudin-hospital', publicName: 'Nasrudin Multispecialty Hospital',
      locationKey: 'mHaybe', publicAddress: 'Near M. Haybe District Local Government, Hargeisa',
      phone: '+252 63 8011111', email: 'info@nasrudinhospital.com',
      websiteUrl: 'https://nasrudinhospital.com/', appointmentUrl: 'https://nasrudinhospital.com/contact/',
      sourceUrl: 'https://nasrudinhospital.com/',
      services: ['pediatrics', 'obstetricsGynecology', 'internalMedicine', 'generalSurgery', 'ent', 'dentistry', 'ophthalmology', 'laboratory', 'imaging', 'emergency'],
      providers: [
        ['Dr Abdirahman M. Nuh', 'pediatrics'], ['Dr Afnan A. Mohamed', 'generalSurgery'],
        ['Dr Bahja Abdirehman', 'pediatrics'], ['Dr Abdikarim Awale', 'pediatrics'],
        ['Dr Sadam Hussein Abdi', 'internalMedicine'], ['Dr Mohamed Amin Jamal', 'ent'],
        ['Dr Ahmed Bashir', 'ent'], ['Dr Siham Hersi', 'obstetricsGynecology']
      ],
      providerSource: 'https://nasrudinhospital.com/doctors/'
    },
    {
      slug: 'hargeisa-london-hospital', publicName: 'Hargeisa London Hospital',
      locationKey: 'xeraAwr', publicAddress: 'Xera Awr Street, If iyo Akhiro intersection, Hargeisa',
      phone: '+252 63 8155335', email: null,
      websiteUrl: 'https://hargeisalondonhospital.com/', appointmentUrl: 'https://hargeisalondonhospital.com/get-an-appointment/',
      sourceUrl: 'https://hargeisalondonhospital.com/contact-us/',
      services: ['internalMedicine', 'obstetricsGynecology', 'gastroenterology', 'pediatrics', 'emergency', 'generalSurgery', 'imaging', 'laboratory', 'pharmacy'],
      providers: [
        ['Dr Ahmed Ali Khazem', 'obstetricsGynecology'], ['Dr Yaroup Mahammad Saker', 'internalMedicine'],
        ['Dr Tarek Abdellatif', 'gastroenterology'], ['Dr Abdikarim Awale Dirie', 'pediatrics'],
        ['Dr Nouh Ismael', 'generalSurgery']
      ],
      providerSource: 'https://hargeisalondonhospital.com/doctors/'
    },
    {
      slug: 'al-ihsan-specialist-hospital', publicName: 'Al Ihsan Specialist Hospital',
      locationKey: '26June', publicAddress: '26 June District, opposite Beerta Xorriyadda, Hargeisa',
      phone: '+252 63 9666624', email: 'info@alihsanhospitals.com',
      websiteUrl: 'https://alihsanhospitals.com/', appointmentUrl: null,
      sourceUrl: 'https://alihsanhospitals.com/',
      services: ['pediatrics', 'urology', 'neurology', 'cardiology', 'dentistry', 'ophthalmology', 'orthopedics', 'obstetricsGynecology', 'internalMedicine', 'ent', 'generalSurgery', 'dermatology'],
      providers: [
        ['Dr Mohamed Mohamud (Dr Shiine)', 'ophthalmology'], ['Dr Mohamed Awle Abdalla', 'gastroenterology'],
        ['Dr Abdulahi Mohamed Khalid', 'residentDoctor'], ['Dr Khaled Mohamud Mohamed', 'residentDoctor']
      ],
      providerSource: 'https://alihsanhospitals.com/'
    },
    {
      slug: 'edna-adan-university-hospital', publicName: 'Edna Adan University Hospital',
      locationKey: 'hargeisa', publicAddress: 'Hargeisa, Somaliland',
      phone: '+252 2 525016', email: null,
      websiteUrl: 'https://www.ednaadanhospital.com/', appointmentUrl: null,
      sourceUrl: 'https://www.ednaadanhospital.com/',
      services: ['maternityObstetric', 'generalMedicine', 'surgery', 'emergency', 'midwifery', 'laboratory', 'pharmacy', 'dentistry']
    }
  ];

  const verifiedAt = new Date('2026-10-27T00:00:00.000Z');
  for (const record of clinicRecords) {
    const { services: serviceNames, providers = [], providerSource, ...clinicData } = record;
    const clinic = await prisma.clinic.upsert({
      where: { slug: record.slug },
      update: { ...clinicData, nameKey: record.slug, verifiedAt, active: true },
      create: { ...clinicData, nameKey: record.slug, verifiedAt, timezone: 'Africa/Mogadishu' }
    });
    await prisma.service.updateMany({ where: { clinicId: clinic.id }, data: { active: false } });
    await prisma.clinicProvider.updateMany({ where: { clinicId: clinic.id }, data: { active: false } });
    for (const nameKey of serviceNames) {
      await prisma.service.upsert({
        where: { clinicId_slug: { clinicId: clinic.id, slug: nameKey } },
        update: { nameKey, durationMinutes: 30, active: true },
        create: { clinicId: clinic.id, slug: nameKey, nameKey, durationMinutes: 30 }
      });
    }
    for (const [displayName, specialty] of providers) {
      await prisma.clinicProvider.upsert({
        where: { clinicId_displayName_specialty: { clinicId: clinic.id, displayName, specialty } },
        update: { sourceUrl: providerSource, profileUrl: providerSource, active: true },
        create: { clinicId: clinic.id, displayName, specialty, sourceUrl: providerSource, profileUrl: providerSource }
      });
    }
  }

  const services = [];
  for (const service of [
    { slug: 'general-consult', nameKey: 'generalConsult', durationMinutes: 45 },
    { slug: 'nutrition-consult', nameKey: 'nutritionConsult', durationMinutes: 45 }
  ]) {
    const record = await prisma.service.upsert({
      where: { clinicId_slug: { clinicId, slug: service.slug } },
      update: { nameKey: service.nameKey, durationMinutes: service.durationMinutes, active: false },
      create: { clinicId, ...service, active: false }
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

  console.info('Seeded the Hargeisa clinic directory and synthetic local development records. Directory details come from the linked clinic sources; DaryeelPass is not connected to their booking systems.');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
