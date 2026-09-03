-- Members/Admin system: split Secretary into Admin/Communication, add Reviewer,
-- and add Rotaract ID + profile photo storage to User.
--
-- Hand-written (not `prisma migrate dev` auto-diff) so the rename is an in-place
-- enum edit rather than a drop/recreate that would lose existing SECRETARY rows.
-- Requires Postgres 12+ (Neon is fine) for ADD VALUE inside a transaction.

ALTER TYPE "Role" RENAME VALUE 'SECRETARY' TO 'SECRETARY_ADMIN';
ALTER TYPE "Role" ADD VALUE 'SECRETARY_COMMUNICATION';
ALTER TYPE "Role" ADD VALUE 'REVIEWER';

ALTER TABLE "users" ADD COLUMN "rotaractId" TEXT;
ALTER TABLE "users" ADD COLUMN "avatarPath" TEXT;
