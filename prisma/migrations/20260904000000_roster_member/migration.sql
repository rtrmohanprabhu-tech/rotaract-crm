-- Official club roster, independent of User (login accounts).
-- Purely additive: one new table, one nullable+unique FK to users. Nothing
-- existing is altered, renamed, or dropped.

CREATE TABLE "roster_members" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "portfolio" TEXT,
    "intendedRole" "Role" NOT NULL DEFAULT 'BOARD_MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "roster_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roster_members_userId_key" ON "roster_members"("userId");

ALTER TABLE "roster_members" ADD CONSTRAINT "roster_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
