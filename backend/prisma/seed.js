import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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

  console.info('Seeded the Hargeisa clinic directory. DaryeelPass is not connected to clinic scheduling systems.');
}

main()
  .catch((error) => {
    console.error('Database seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
