/**
 * One-time Super Admin bootstrap.
 *
 * Creates exactly one user with role SUPER_ADMIN, from credentials supplied
 * only via environment variables — nothing is hard-coded, printed, logged,
 * or written to disk. Use this only when no admin account exists yet to sign
 * in and use the Members page (the normal, preferred way to add people).
 *
 * Safety:
 *  - Never touches any user other than the one email given.
 *  - If that email already exists, it changes nothing and just reports the
 *    current state — it will not silently overwrite a role or password.
 *  - The password is hashed with the same bcrypt cost (12) already used by
 *    upsertMemberAction; the plaintext is never logged.
 *
 * Usage (run this yourself, in your own terminal — not pasted to an AI):
 *
 *   DATABASE_URL="<target database>" \
 *   BOOTSTRAP_ADMIN_EMAIL="you@example.org" \
 *   BOOTSTRAP_ADMIN_PASSWORD="a strong password" \
 *   BOOTSTRAP_ADMIN_NAME="Rtr. Name" \
 *   npx tsx scripts/bootstrap-super-admin.ts
 *
 * BOOTSTRAP_ADMIN_NAME is optional (defaults to "Rtr. Super Admin").
 * DATABASE_URL defaults to whatever is already in your environment/.env —
 * set it explicitly on the command line when you need to target a
 * database other than your local .env (e.g. production).
 */
import '../src/lib/env-first.js'; // must stay first — see that module
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }) });

function fail(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exitCode = 1;
  throw new Error(message);
}

async function main() {
  if (!process.env.DATABASE_URL) fail('DATABASE_URL is not set.');

  const rawEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Rtr. Super Admin';

  if (!rawEmail) fail('BOOTSTRAP_ADMIN_EMAIL is not set.');
  if (!password) fail('BOOTSTRAP_ADMIN_PASSWORD is not set.');
  if (password.length < 8) fail('BOOTSTRAP_ADMIN_PASSWORD must be at least 8 characters.');

  const email = rawEmail.toLowerCase().trim();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, isActive: true, deletedAt: true, createdAt: true },
  });

  if (existing) {
    console.log('\nA user with this email already exists — nothing was changed.\n');
    console.log(
      JSON.stringify(
        { id: existing.id, email: existing.email, role: existing.role, isActive: existing.isActive, deletedAt: existing.deletedAt },
        null,
        2,
      ),
    );
    console.log(
      '\nIf this account needs a different role, password, or to be reactivated, do that from the Members page' +
        ' once you can sign in as an admin — this script will not modify an existing account.\n',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const created = await prisma.user.create({
    data: {
      email,
      name,
      role: 'SUPER_ADMIN',
      isActive: true,
      passwordHash,
    },
    select: { id: true, email: true, role: true, isActive: true, deletedAt: true, createdAt: true },
  });

  console.log('\n✓ Super Admin account created.\n');
  console.log(JSON.stringify(created, null, 2));
  console.log('\nSign in at /login with this email and the password you supplied — never printed here.\n');
}

main()
  .catch((error) => {
    if (process.exitCode !== 1) {
      console.error('\nBootstrap failed:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
