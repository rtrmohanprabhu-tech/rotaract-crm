/**
 * Demo data (§51).
 *
 * The reference PDF's club details are used only as *example* values so the
 * dashboard looks realistic on first run — every one of them is editable in
 * Settings and nothing here is hard-coded into the app. Personal data from the
 * reference is not reproduced: members are sample names.
 *
 * Run with:  npm run db:seed
 */
import '../src/lib/env-first.js'; // must stay first — see that module
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { BeneficiaryCategory, EventStatus, FundingSource } from '../src/generated/prisma/enums.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }) });

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR ?? './.uploads');
const PASSWORD = process.env.SEED_PASSWORD ?? 'Rotaract@2026';

const AVENUES = [
  { name: 'Community Service', slug: 'community-service', color: '#cd2a63' },
  { name: 'Club Service', slug: 'club-service', color: '#1f7ae0' },
  { name: 'Professional Development', slug: 'professional-development', color: '#7c3aed' },
  { name: 'International Service', slug: 'international-service', color: '#0d9488' },
  { name: 'Fellowship', slug: 'fellowship', color: '#f59e0b' },
  { name: 'Sports', slug: 'sports', color: '#16a34a' },
  { name: 'Public Image', slug: 'public-image', color: '#e11d48' },
  { name: 'Other', slug: 'other', color: '#64748b' },
];

const POSITIONS = [
  'President',
  'Secretary — Administration',
  'Secretary — Communication',
  'Treasurer',
  'Director — Community Service',
  'Director — Club Service',
  'Director — Professional Development',
  'Editor',
  'Member',
];

/** Generates a readable placeholder photo so the demo has real files to sync. */
async function placeholderPhoto(title: string, subtitle: string, hue: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue},62%,52%)"/>
        <stop offset="100%" stop-color="hsl(${(hue + 40) % 360},58%,38%)"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="800" fill="url(#g)"/>
    <text x="60" y="380" font-family="Helvetica,Arial,sans-serif" font-size="64" font-weight="bold" fill="white">${title.replace(/[<&>]/g, '')}</text>
    <text x="62" y="440" font-family="Helvetica,Arial,sans-serif" font-size="30" fill="rgba(255,255,255,.85)">${subtitle.replace(/[<&>]/g, '')}</text>
    <text x="62" y="740" font-family="Helvetica,Arial,sans-serif" font-size="22" fill="rgba(255,255,255,.7)">Sample photograph — replace with your own</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

async function savePhoto(eventCode: string, buffer: Buffer, index: number) {
  const dir = path.join(UPLOAD_ROOT, eventCode, 'photos');
  await mkdir(dir, { recursive: true });
  const base = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const file = path.join(dir, `${base}.jpg`);
  const thumb = path.join(dir, `${base}_thumb.webp`);
  await writeFile(file, buffer);
  await sharp(buffer).resize({ width: 640 }).webp({ quality: 78 }).toFile(thumb);
  return {
    storagePath: path.relative(UPLOAD_ROOT, file),
    thumbnailPath: path.relative(UPLOAD_ROOT, thumb),
    size: buffer.byteLength,
    fileName: `${eventCode}_photo_${index + 1}.jpg`,
  };
}

type SeedEvent = {
  name: string;
  avenue: string;
  date: string;
  start: string;
  end?: string;
  chair: string;
  cost: number;
  funding?: FundingSource;
  rotaractors: number;
  rotarians: number;
  council: number;
  guests: number;
  direct: number;
  indirect: number;
  beneficiaries: BeneficiaryCategory[];
  venue: string;
  city: string;
  partner?: string;
  partnerType?: 'COLLEGE' | 'NGO' | 'SCHOOL' | 'ROTARY_CLUB';
  project?: string;
  phase?: number;
  status: EventStatus;
  description: string;
  objective?: string;
  impact?: string;
};

const EVENTS: SeedEvent[] = [
  {
    name: 'Care2Cook',
    avenue: 'Community Service',
    date: '2026-01-30',
    start: '11:30',
    end: '13:30',
    chair: 'Rtr. Akshaya Lakshmi',
    cost: 4534,
    funding: 'CLUB_FUND',
    rotaractors: 14,
    rotarians: 0,
    council: 0,
    guests: 6,
    direct: 60,
    indirect: 180,
    beneficiaries: ['SCHOOL_STUDENTS', 'CHILDREN'],
    venue: 'Madhukarai Government School',
    city: 'Coimbatore',
    partner: 'Sri Sakthi Institute of Engineering and Technology',
    partnerType: 'COLLEGE',
    status: 'APPROVED',
    description:
      'Care2Cook supports the health and well-being of school children by strengthening the school kitchen. A mixer grinder was donated to help prepare nutritious and hygienic meals for students, and the team spoke with the kitchen staff about safe food handling.',
    objective: 'Improve the school kitchen so nutritious meals can be prepared quickly and hygienically.',
    impact: 'The kitchen now serves 60 students daily with less preparation time and better hygiene.',
  },
  {
    name: 'Avalukkaga — Phase 6',
    avenue: 'Community Service',
    date: '2026-01-12',
    start: '15:00',
    end: '17:00',
    chair: 'Rtr. Kanishka',
    cost: 100,
    funding: 'MEMBER_CONTRIBUTION',
    rotaractors: 3,
    rotarians: 0,
    council: 0,
    guests: 0,
    direct: 45,
    indirect: 90,
    beneficiaries: ['WOMEN', 'GENERAL_PUBLIC'],
    venue: 'Around Coimbatore',
    city: 'Coimbatore',
    project: 'Avalukkaga',
    phase: 6,
    status: 'APPROVED',
    description:
      'Avalukkaga Phase 6 continued the club’s hygiene and well-being initiative, distributing sanitary kits and speaking with women about sustainable hygiene practices.',
    objective: 'Raise awareness about menstrual hygiene and distribute kits where they are most needed.',
  },
  {
    name: 'Mazhalai Karangal — Phase 6',
    avenue: 'Community Service',
    date: '2026-01-12',
    start: '16:00',
    end: '18:00',
    chair: 'Rtr. Santhiya',
    cost: 752,
    funding: 'CLUB_FUND',
    rotaractors: 3,
    rotarians: 0,
    council: 1,
    guests: 0,
    direct: 25,
    indirect: 75,
    beneficiaries: ['CHILDREN', 'FAMILIES', 'PATIENTS'],
    venue: 'Government Hospital, Coimbatore',
    city: 'Coimbatore',
    project: 'Mazhalai Karangal',
    phase: 6,
    status: 'APPROVED',
    description:
      'Mazhalai Karangal Phase 6 supported newborns and their families at the government hospital with essential aid kits, continuing the club’s commitment to care during the earliest stages of life.',
    impact: '25 families received newborn care kits.',
  },
  {
    name: 'Blood Donation Camp',
    avenue: 'Community Service',
    date: '2026-02-14',
    start: '09:00',
    end: '15:00',
    chair: 'Rtr. Dhanush',
    cost: 3200,
    funding: 'ROTARY_CLUB',
    rotaractors: 22,
    rotarians: 4,
    council: 5,
    guests: 40,
    direct: 96,
    indirect: 288,
    beneficiaries: ['PATIENTS', 'COMMUNITY'],
    venue: 'College Auditorium',
    city: 'Coimbatore',
    partner: 'Government Blood Bank',
    partnerType: 'GOVERNMENT' as never,
    status: 'APPROVED',
    description:
      'A day-long blood donation camp organised with the district blood bank. 96 units were collected and every donor received a health check before donating.',
    objective: 'Collect at least 75 units of blood for the district blood bank.',
    impact: '96 units collected, exceeding the target.',
  },
  {
    name: 'Tree Plantation Drive',
    avenue: 'Community Service',
    date: '2026-03-05',
    start: '07:00',
    end: '10:00',
    chair: 'Rtr. Krishna Rajpurohit',
    cost: 1800,
    funding: 'DONATION',
    rotaractors: 18,
    rotarians: 2,
    council: 3,
    guests: 12,
    direct: 0,
    indirect: 500,
    beneficiaries: ['ENVIRONMENT', 'COMMUNITY'],
    venue: 'Lakeside Park',
    city: 'Coimbatore',
    status: 'APPROVED',
    description:
      '150 saplings were planted along the lakeside with the municipal corporation. Each sapling was tagged and assigned to a member for follow-up watering over the next three months.',
  },
  {
    name: 'Resume Building Workshop',
    avenue: 'Professional Development',
    date: '2026-02-22',
    start: '14:00',
    end: '16:30',
    chair: 'Rtr. Hashish Laa',
    cost: 0,
    rotaractors: 26,
    rotarians: 1,
    council: 4,
    guests: 18,
    direct: 45,
    indirect: 0,
    beneficiaries: ['COLLEGE_STUDENTS', 'ROTARACTORS'],
    venue: 'Seminar Hall B',
    city: 'Coimbatore',
    status: 'APPROVED',
    description:
      'An HR professional walked members through resume structure, common mistakes and interview preparation, followed by a hands-on review session where 45 resumes were reviewed one-on-one.',
    objective: 'Help final-year members prepare for campus placements.',
  },
  {
    name: 'Installation Ceremony 2026-27',
    avenue: 'Club Service',
    date: '2026-07-19',
    start: '17:30',
    end: '20:30',
    chair: 'Rtr. Vinith',
    cost: 18500,
    funding: 'CLUB_FUND',
    rotaractors: 42,
    rotarians: 12,
    council: 11,
    guests: 60,
    direct: 0,
    indirect: 0,
    beneficiaries: ['ROTARACTORS'],
    venue: 'Hotel Grand Palace',
    city: 'Coimbatore',
    status: 'APPROVED',
    description:
      'The new board for 2026-27 was installed in the presence of the sponsoring Rotary club, the district team and parents. The outgoing board presented the annual report.',
  },
  {
    name: 'Inter-Club Cricket Tournament',
    avenue: 'Sports',
    date: '2026-08-09',
    start: '08:00',
    end: '18:00',
    chair: 'Rtr. Santhiya',
    cost: 9400,
    funding: 'SPONSOR',
    rotaractors: 35,
    rotarians: 3,
    council: 8,
    guests: 55,
    direct: 0,
    indirect: 0,
    beneficiaries: ['ROTARACTORS'],
    venue: 'City Sports Ground',
    city: 'Coimbatore',
    partner: 'Rotaract Club of Coimbatore Central',
    partnerType: 'ROTARACT_CLUB' as never,
    status: 'SUBMITTED',
    description:
      'Eight Rotaract clubs took part in a one-day cricket tournament that raised funds for the club’s community service projects.',
  },
  {
    name: 'World Literacy Day Awareness',
    avenue: 'International Service',
    date: '2026-08-20',
    start: '10:00',
    end: '12:00',
    chair: 'Rtr. Akshaya Lakshmi',
    cost: 650,
    funding: 'CLUB_FUND',
    rotaractors: 12,
    rotarians: 0,
    council: 2,
    guests: 0,
    direct: 120,
    indirect: 240,
    beneficiaries: ['SCHOOL_STUDENTS', 'CHILDREN'],
    venue: 'Panchayat Union School',
    city: 'Coimbatore',
    status: 'UNDER_REVIEW',
    description:
      'Members read with students from classes 3 to 5 and donated 60 story books to the school library to mark World Literacy Day.',
  },
  {
    name: 'Beach Clean-up Fellowship',
    avenue: 'Fellowship',
    date: '2026-08-24',
    start: '06:30',
    end: '09:30',
    chair: 'Rtr. Dhanush',
    cost: 2100,
    funding: 'MEMBER_CONTRIBUTION',
    rotaractors: 20,
    rotarians: 1,
    council: 4,
    guests: 8,
    direct: 0,
    indirect: 300,
    beneficiaries: ['ENVIRONMENT', 'COMMUNITY'],
    venue: 'Marina Beach',
    city: 'Chennai',
    status: 'CORRECTION_REQUIRED',
    description: 'Members collected 40 kg of plastic waste from the shoreline and segregated it for recycling.',
  },
  {
    name: 'Social Media Skills Session',
    avenue: 'Public Image',
    date: '2026-08-27',
    start: '19:00',
    end: '20:00',
    chair: 'Rtr. Krishna Rajpurohit',
    cost: 0,
    rotaractors: 16,
    rotarians: 0,
    council: 3,
    guests: 2,
    direct: 0,
    indirect: 0,
    beneficiaries: ['ROTARACTORS'],
    venue: 'Google Meet',
    city: 'Online',
    status: 'DRAFT',
    description: 'An online session on photographing and captioning club projects so that reports look consistent.',
  },
];

async function main() {
  console.log('Seeding Rotaract Event Reporting CRM…');

  const clubDefaults = {
    clubName: 'Rotaract Club of Sri Ramakrishna College of Arts and Science',
    rotarySponsor: 'Rotary Club of Sample City Midtown',
    clubId: '0000',
    groupName: '01',
    riDistrict: '3206',
    presidentName: 'Rtr. Mohan Prabhu',
    secretaryName: 'Rtr. Rithika',
    currentYear: '2026-27',
    currency: 'INR',
    minPhotos: 3,
    maxPhotos: 20,
    reportingDeadlineHrs: 48,
  };
  await prisma.clubSettings.upsert({
    where: { id: 'club' },
    update: clubDefaults,
    create: { id: 'club', ...clubDefaults },
  });

  for (const [index, avenue] of AVENUES.entries()) {
    await prisma.avenue.upsert({
      where: { slug: avenue.slug },
      update: { name: avenue.name, color: avenue.color, sortOrder: index },
      create: { ...avenue, sortOrder: index },
    });
  }

  for (const [index, title] of POSITIONS.entries()) {
    await prisma.boardPosition.upsert({ where: { title }, update: { sortOrder: index }, create: { title, sortOrder: index } });
  }

  const avenues = await prisma.avenue.findMany();
  const positions = await prisma.boardPosition.findMany();
  const avenueByName = (name: string) => avenues.find((a) => a.name === name)!;
  const positionByTitle = (title: string) => positions.find((p) => p.title === title)?.id ?? null;

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const people = [
    { name: 'Rtr. Admin', email: 'admin@rotaract.demo', role: 'SUPER_ADMIN' as const, position: null, avenue: null },
    { name: 'Rtr. Vinith', email: 'president@rotaract.demo', role: 'PRESIDENT' as const, position: 'President', avenue: null },
    { name: 'Rtr. Dhanush', email: 'secretary@rotaract.demo', role: 'SECRETARY_ADMIN' as const, position: 'Secretary — Administration', avenue: null },
    {
      name: 'Rtr. Kanishka',
      email: 'director.cs@rotaract.demo',
      role: 'DIRECTOR' as const,
      position: 'Director — Community Service',
      avenue: 'Community Service',
    },
    { name: 'Rtr. Akshaya Lakshmi', email: 'akshaya@rotaract.demo', role: 'BOARD_MEMBER' as const, position: 'Member', avenue: null },
    { name: 'Rtr. Santhiya', email: 'santhiya@rotaract.demo', role: 'BOARD_MEMBER' as const, position: 'Member', avenue: null },
    { name: 'Rtr. Hashish Laa', email: 'hashish@rotaract.demo', role: 'BOARD_MEMBER' as const, position: 'Editor', avenue: null },
    {
      name: 'Rtr. Krishna Rajpurohit',
      email: 'krishna@rotaract.demo',
      role: 'SECRETARY_COMMUNICATION' as const,
      position: 'Secretary — Communication',
      avenue: null,
    },
    { name: 'Rtr. Reviewer', email: 'reviewer@rotaract.demo', role: 'REVIEWER' as const, position: 'Member', avenue: null },
    { name: 'Rtr. Member', email: 'member@rotaract.demo', role: 'VIEWER' as const, position: 'Member', avenue: null },
  ];

  const users = new Map<string, string>();
  for (const person of people) {
    const user = await prisma.user.upsert({
      where: { email: person.email },
      update: { name: person.name, role: person.role },
      create: {
        name: person.name,
        email: person.email,
        role: person.role,
        passwordHash,
        boardPositionId: person.position ? positionByTitle(person.position) : null,
        avenueId: person.avenue ? avenueByName(person.avenue).id : null,
      },
    });
    users.set(person.name, user.id);
  }

  for (const name of ['Avalukkaga', 'Mazhalai Karangal']) {
    await prisma.project.upsert({
      where: { name },
      update: {},
      create: {
        name,
        slug: name.toLowerCase().replace(/\s+/g, '-'),
        description: `${name} is a recurring community service initiative run in phases.`,
      },
    });
  }
  const projects = await prisma.project.findMany();

  let sequence = new Map<number, number>();
  for (const [index, seed] of EVENTS.entries()) {
    const date = new Date(`${seed.date}T00:00:00Z`);
    const year = date.getUTCFullYear();
    const next = (sequence.get(year) ?? 0) + 1;
    sequence.set(year, next);
    const eventCode = `EVT-${year}-${String(next).padStart(4, '0')}`;

    if (await prisma.event.findUnique({ where: { eventId: eventCode } })) continue;

    const chairId = users.get(seed.chair) ?? users.get('Rtr. Akshaya Lakshmi')!;
    const avenue = avenueByName(seed.avenue);
    const project = seed.project ? projects.find((p) => p.name === seed.project) : null;
    const totalParticipants = seed.rotaractors + seed.rotarians + seed.council + seed.guests;

    const event = await prisma.event.create({
      data: {
        eventId: eventCode,
        eventName: seed.name,
        eventDate: date,
        startTime: seed.start,
        endTime: seed.end,
        eventType: seed.city === 'Online' ? 'ONLINE' : 'PHYSICAL',
        avenueId: avenue.id,
        chairId,
        createdById: chairId,
        venue: seed.city === 'Online' ? null : seed.venue,
        platform: seed.city === 'Online' ? seed.venue : null,
        city: seed.city === 'Online' ? null : seed.city,
        state: seed.city === 'Online' ? null : 'Tamil Nadu',
        country: 'India',
        isCollaboration: Boolean(seed.partner),
        projectWith: seed.partner ?? 'SELF',
        rotaractorsPresent: seed.rotaractors,
        rotariansPresent: seed.rotarians,
        councilPresent: seed.council,
        guestsPresent: seed.guests,
        totalParticipants,
        directBeneficiaries: seed.direct,
        indirectBeneficiaries: seed.indirect,
        totalBeneficiaries: seed.direct + seed.indirect,
        hasExpenses: seed.cost > 0,
        eventCost: seed.cost,
        fundingSource: seed.funding ?? null,
        description: seed.description,
        rawDescription: seed.description.slice(0, 120),
        objective: seed.objective,
        impact: seed.impact,
        projectId: project?.id ?? null,
        projectName: seed.project ?? null,
        phaseNumber: seed.phase ?? null,
        status: seed.status,
        submittedAt: seed.status === 'DRAFT' ? null : new Date(date.getTime() + 36 * 3600 * 1000),
        approvedAt: seed.status === 'APPROVED' ? new Date(date.getTime() + 72 * 3600 * 1000) : null,
        lockedForEdits: seed.status === 'APPROVED',
        driveSyncStatus: 'PENDING',
        beneficiaries: { create: seed.beneficiaries.map((category) => ({ category })) },
        collaborators: seed.partner
          ? { create: [{ orgName: seed.partner, orgType: (seed.partnerType ?? 'OTHER') as never }] }
          : undefined,
        socialLinks:
          index % 3 === 0
            ? { create: [{ platform: 'INSTAGRAM', url: 'https://www.instagram.com/p/sample-post/' }] }
            : undefined,
        statusHistory: {
          create: [
            { to: 'DRAFT', actorId: chairId, note: 'Draft created' },
            ...(seed.status !== 'DRAFT' ? [{ to: 'SUBMITTED' as const, actorId: chairId, note: 'Submitted for review' }] : []),
            ...(seed.status === 'APPROVED'
              ? [{ to: 'APPROVED' as const, actorId: users.get('Rtr. Vinith')!, note: 'Approved by President' }]
              : []),
            ...(seed.status === 'CORRECTION_REQUIRED'
              ? [
                  {
                    to: 'CORRECTION_REQUIRED' as const,
                    actorId: users.get('Rtr. Dhanush')!,
                    note: 'Please upload at least 3 event photographs and the attendance sheet.',
                  },
                ]
              : []),
          ],
        },
      },
    });

    // Placeholder photographs so the gallery, Drive sync and PDF are testable.
    const photoCount = seed.status === 'DRAFT' ? 1 : 3;
    for (let i = 0; i < photoCount; i += 1) {
      const buffer = await placeholderPhoto(seed.name, `${seed.avenue} · ${seed.date}`, (index * 47 + i * 20) % 360);
      const saved = await savePhoto(eventCode, buffer, i);
      await prisma.eventPhoto.create({
        data: {
          eventId: event.id,
          fileName: saved.fileName,
          mimeType: 'image/jpeg',
          size: saved.size,
          width: 1200,
          height: 800,
          storagePath: saved.storagePath,
          thumbnailPath: saved.thumbnailPath,
          sortOrder: i,
          caption: i === 0 ? `${seed.name} — team at the venue` : i === 1 ? 'Event poster' : 'Distribution in progress',
        },
      });
    }

    if (seed.status === 'CORRECTION_REQUIRED') {
      await prisma.eventComment.create({
        data: {
          eventId: event.id,
          authorId: users.get('Rtr. Dhanush')!,
          body: 'Please upload at least 3 event photographs and add the attendance sheet before resubmitting.',
        },
      });
      await prisma.eventReview.create({
        data: { eventId: event.id, reviewerId: users.get('Rtr. Dhanush')!, decision: 'CORRECTION_REQUESTED', note: 'Missing photographs.' },
      });
    }

    await prisma.auditLog.createMany({
      data: [
        {
          actorId: chairId,
          actorLabel: seed.chair,
          action: 'event.create',
          entityType: 'event',
          entityId: event.id,
          summary: `${seed.chair} created report ${eventCode} — ${seed.name}`,
        },
        ...(seed.status !== 'DRAFT'
          ? [
              {
                actorId: chairId,
                actorLabel: seed.chair,
                action: 'event.submit',
                entityType: 'event',
                entityId: event.id,
                summary: `${seed.chair} submitted ${eventCode}`,
              },
            ]
          : []),
        ...(seed.status === 'APPROVED'
          ? [
              {
                actorId: users.get('Rtr. Vinith')!,
                actorLabel: 'Rtr. Vinith',
                action: 'event.approved',
                entityType: 'event',
                entityId: event.id,
                summary: `Rtr. Vinith approved ${eventCode}`,
              },
            ]
          : []),
      ],
    });

    // Refresh the completeness score using the same rules the app uses.
    const photos = await prisma.eventPhoto.count({ where: { eventId: event.id } });
    await prisma.event.update({
      where: { id: event.id },
      data: { completeness: Math.min(100, 55 + photos * 10 + (seed.objective ? 8 : 0) + (seed.impact ? 7 : 0)) },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        userId: users.get('Rtr. Vinith')!,
        type: 'REVIEW_PENDING',
        title: '2 reports are waiting for your review',
        body: 'Inter-Club Cricket Tournament and World Literacy Day Awareness.',
        link: '/reviews',
      },
      {
        userId: users.get('Rtr. Dhanush')!,
        type: 'CORRECTION_REQUESTED',
        title: 'Beach Clean-up Fellowship needs a correction',
        body: 'Photographs and attendance sheet are missing.',
        link: '/my-events',
      },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    events: await prisma.event.count(),
    photos: await prisma.eventPhoto.count(),
  };

  console.log('Seed complete:', counts);
  console.log(`\nDemo sign-ins (password: ${PASSWORD})`);
  for (const person of people) console.log(`  ${person.role.padEnd(13)} ${person.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
