/**
 * One-time import of the official 2026-27 club roster into RosterMember.
 *
 * Names and portfolios are the source of truth as supplied by the club —
 * preserved verbatim, not normalized or fuzzy-matched. No emails or
 * passwords are invented: everyone here gets a roster entry only; a login
 * is created separately (Members page → Create login) once a real email is
 * available.
 *
 * Idempotent: matches by exact name. If a roster entry with that exact name
 * already exists, its portfolio/intendedRole are updated in place rather
 * than creating a duplicate. Never touches the User table except for the one
 * explicit link below (Mohan Prabhu → his existing SUPER_ADMIN account) —
 * and that link only sets RosterMember.userId, never anything on User itself.
 *
 *   npx tsx scripts/import-official-roster.ts
 */
import '../src/lib/env-first.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { Role } from '../src/generated/prisma/enums.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }) });

type Entry = { name: string; portfolio: string; intendedRole: Role; linkUserEmail?: string };

const ROSTER: Entry[] = [
  { name: 'Rtr. Nitesh Kumar', portfolio: 'Web Service Chair', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Rithika', portfolio: 'Secretary Administration', intendedRole: 'SECRETARY_ADMIN' },
  { name: 'Rtr. Nikhita Murugesan', portfolio: 'Club Service Chair', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Negarigaa', portfolio: 'Community Service Director', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Manoj', portfolio: 'Club Service Director', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Sushimitha', portfolio: 'Joint Treasurer', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Akash', portfolio: 'Community Service Chair', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Amirtha Varshini', portfolio: 'Treasurer', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Sai Pranesh', portfolio: 'Blood donor cell', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Aswathi', portfolio: 'District Priority Project Chair', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Srivishnupriya', portfolio: 'Content writer', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Dharsan', portfolio: 'International Service Chair', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Meenakshi', portfolio: 'The Rotaract Foundation', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Rakshana Devi', portfolio: 'Rotaract Learning Felicitation', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Thamizhvanan', portfolio: 'International Service Director', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Athulya Menon', portfolio: 'Professional Service Chair', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Giya', portfolio: 'All Avenue Chair', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Shrinidhi', portfolio: 'Secretary Communication', intendedRole: 'SECRETARY_COMMUNICATION' },
  { name: 'Rtr. Karthika', portfolio: 'The Rotaract Foundation', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rrt. Gugan', portfolio: 'Professional Service Director', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Madhumitha', portfolio: 'District Priority Projects Director', intendedRole: 'BOARD_MEMBER' },
  {
    name: 'Rtr. Mohan Prabhu',
    portfolio: 'President',
    intendedRole: 'SUPER_ADMIN',
    linkUserEmail: 'racsrcas3206@gmail.com',
  },
  { name: 'Rtr. Dibin D’cruz', portfolio: 'Rotary Rotaract Relation', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Hashish', portfolio: 'Event Advisor', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. PP. Deepak', portfolio: 'Club Advisor', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. PP. Kartheepan', portfolio: 'Club Advisor', intendedRole: 'BOARD_MEMBER' },
  { name: 'Rtr. Srihari', portfolio: 'Vice President', intendedRole: 'BOARD_MEMBER' },
];

async function main() {
  let created = 0;
  let updated = 0;

  for (const entry of ROSTER) {
    let userId: string | null = null;
    if (entry.linkUserEmail) {
      const user = await prisma.user.findUnique({ where: { email: entry.linkUserEmail } });
      if (!user) {
        console.warn(`  ! Could not find user ${entry.linkUserEmail} to link for ${entry.name} — leaving unlinked.`);
      } else {
        userId = user.id;
      }
    }

    const existing = await prisma.rosterMember.findFirst({ where: { name: entry.name, deletedAt: null } });
    if (existing) {
      await prisma.rosterMember.update({
        where: { id: existing.id },
        data: {
          portfolio: entry.portfolio,
          intendedRole: entry.intendedRole,
          ...(userId && !existing.userId ? { userId } : {}),
        },
      });
      updated += 1;
      console.log(`  ~ updated: ${entry.name} — ${entry.portfolio}`);
    } else {
      await prisma.rosterMember.create({
        data: {
          name: entry.name,
          portfolio: entry.portfolio,
          intendedRole: entry.intendedRole,
          isActive: true,
          ...(userId ? { userId } : {}),
        },
      });
      created += 1;
      console.log(`  + created: ${entry.name} — ${entry.portfolio}`);
    }
  }

  console.log(`\nDone. ${created} created, ${updated} updated, ${ROSTER.length} total in the official list.`);
}

main()
  .catch((error) => {
    console.error('Import failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
