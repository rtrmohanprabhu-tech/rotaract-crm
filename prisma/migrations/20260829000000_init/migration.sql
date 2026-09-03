-- Initial schema for the Rotaract Event Reporting CRM.
-- Apply with:  npx prisma migrate deploy      (or `npx prisma db push` in dev)

-- ============================== ENUMS ======================================
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'PRESIDENT', 'SECRETARY', 'DIRECTOR', 'BOARD_MEMBER', 'VIEWER');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'CORRECTION_REQUIRED', 'APPROVED', 'ARCHIVED');
CREATE TYPE "EventType" AS ENUM ('PHYSICAL', 'ONLINE', 'HYBRID');
CREATE TYPE "OrgType" AS ENUM ('ROTARY_CLUB', 'ROTARACT_CLUB', 'NGO', 'SCHOOL', 'COLLEGE', 'UNIVERSITY', 'CORPORATE', 'GOVERNMENT', 'COMMUNITY_ORG', 'OTHER');
CREATE TYPE "FundingSource" AS ENUM ('CLUB_FUND', 'ROTARY_CLUB', 'SPONSOR', 'DONATION', 'MEMBER_CONTRIBUTION', 'PARTNER_ORGANIZATION', 'OTHER');
CREATE TYPE "BeneficiaryCategory" AS ENUM ('CHILDREN', 'STUDENTS', 'WOMEN', 'MEN', 'SENIOR_CITIZENS', 'PATIENTS', 'FAMILIES', 'SCHOOL_STUDENTS', 'COLLEGE_STUDENTS', 'DIFFERENTLY_ABLED', 'GENERAL_PUBLIC', 'COMMUNITY', 'ENVIRONMENT', 'ANIMALS', 'ROTARACTORS', 'OTHER');
CREATE TYPE "ParticipantGroup" AS ENUM ('ROTARACTOR', 'ROTARIAN', 'COUNCIL', 'GUEST');
CREATE TYPE "DocumentCategory" AS ENUM ('POSTER', 'ATTENDANCE_SHEET', 'BILL', 'INVOICE', 'PERMISSION_LETTER', 'APPRECIATION_LETTER', 'CERTIFICATE', 'NEWSPAPER_COVERAGE', 'SOCIAL_MEDIA_SCREENSHOT', 'GENERATED_REPORT', 'OTHER');
CREATE TYPE "SocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'YOUTUBE', 'WEBSITE', 'OTHER');
CREATE TYPE "DriveSyncStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SYNCING', 'SYNCED', 'FAILED');
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'CORRECTION_REQUESTED', 'REJECTED', 'COMMENT');
CREATE TYPE "NotificationType" AS ENUM ('EVENT_SUBMITTED', 'EVENT_APPROVED', 'CORRECTION_REQUESTED', 'EVENT_RESUBMITTED', 'REPORT_OVERDUE', 'REVIEW_PENDING', 'DRIVE_SYNC_FAILED', 'GENERIC');
CREATE TYPE "ReportKind" AS ENUM ('EVENT', 'MONTHLY', 'AVENUE', 'ANNUAL');

-- ============================== CLUB CONFIG ================================
CREATE TABLE "avenues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#cd2a63',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "avenues_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "avenues_name_key" ON "avenues"("name");
CREATE UNIQUE INDEX "avenues_slug_key" ON "avenues"("slug");

CREATE TABLE "board_positions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "board_positions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "board_positions_title_key" ON "board_positions"("title");

CREATE TABLE "club_settings" (
    "id" TEXT NOT NULL DEFAULT 'club',
    "clubName" TEXT NOT NULL DEFAULT 'Rotaract Club',
    "rotarySponsor" TEXT NOT NULL DEFAULT '',
    "clubId" TEXT NOT NULL DEFAULT '',
    "groupName" TEXT NOT NULL DEFAULT '',
    "riDistrict" TEXT NOT NULL DEFAULT '',
    "presidentName" TEXT NOT NULL DEFAULT '',
    "secretaryName" TEXT NOT NULL DEFAULT '',
    "currentYear" TEXT NOT NULL DEFAULT '2026-27',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "logoUrl" TEXT,
    "minPhotos" INTEGER NOT NULL DEFAULT 3,
    "maxPhotos" INTEGER NOT NULL DEFAULT 20,
    "reportingDeadlineHrs" INTEGER NOT NULL DEFAULT 48,
    "requiredFields" TEXT[] DEFAULT ARRAY['eventName', 'eventDate', 'avenueId', 'chairId', 'venue', 'participation', 'beneficiaries', 'description', 'photos']::TEXT[],
    "driveRootFolderId" TEXT,
    "driveRootFolderUrl" TEXT,
    "driveConnectedById" TEXT,
    "driveConnectedAt" TIMESTAMP(3),
    "reportSections" JSONB NOT NULL DEFAULT '{"eventName":true,"chair":true,"date":true,"avenue":true,"cost":true,"beneficiaries":true,"participation":true,"venue":true,"description":true,"impact":true,"collaboration":true,"socialMedia":false,"photos":true,"internalNotes":false,"reviewerComments":false}',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "club_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "projects_name_key" ON "projects"("name");
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- ============================== AUTH =======================================
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'BOARD_MEMBER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "boardPositionId" TEXT,
    "avenueId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");
CREATE INDEX "users_avenueId_idx" ON "users"("avenueId");

CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- ============================== EVENTS =====================================
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "eventType" "EventType" NOT NULL DEFAULT 'PHYSICAL',
    "avenueId" TEXT NOT NULL,
    "chairId" TEXT,
    "chairNameText" TEXT,
    "secretaryId" TEXT,
    "directorId" TEXT,
    "venue" TEXT,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "state" TEXT,
    "country" TEXT DEFAULT 'India',
    "platform" TEXT,
    "meetingLink" TEXT,
    "isCollaboration" BOOLEAN NOT NULL DEFAULT false,
    "projectWith" TEXT NOT NULL DEFAULT 'SELF',
    "rotaractorsPresent" INTEGER NOT NULL DEFAULT 0,
    "rotariansPresent" INTEGER NOT NULL DEFAULT 0,
    "councilPresent" INTEGER NOT NULL DEFAULT 0,
    "guestsPresent" INTEGER NOT NULL DEFAULT 0,
    "totalParticipants" INTEGER NOT NULL DEFAULT 0,
    "directBeneficiaries" INTEGER NOT NULL DEFAULT 0,
    "indirectBeneficiaries" INTEGER NOT NULL DEFAULT 0,
    "totalBeneficiaries" INTEGER NOT NULL DEFAULT 0,
    "beneficiaryNotes" TEXT,
    "hasExpenses" BOOLEAN NOT NULL DEFAULT false,
    "eventCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "fundingSource" "FundingSource",
    "sponsorName" TEXT,
    "expenseNotes" TEXT,
    "description" TEXT,
    "rawDescription" TEXT,
    "objective" TEXT,
    "accomplished" TEXT,
    "impact" TEXT,
    "specialOutcome" TEXT,
    "feedback" TEXT,
    "internalNotes" TEXT,
    "projectId" TEXT,
    "projectName" TEXT,
    "phaseNumber" INTEGER,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "completeness" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "lockedForEdits" BOOLEAN NOT NULL DEFAULT false,
    "driveSyncStatus" "DriveSyncStatus" NOT NULL DEFAULT 'PENDING',
    "driveSyncError" TEXT,
    "driveSyncedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "events_eventId_key" ON "events"("eventId");
CREATE INDEX "events_status_idx" ON "events"("status");
CREATE INDEX "events_eventDate_idx" ON "events"("eventDate");
CREATE INDEX "events_avenueId_idx" ON "events"("avenueId");
CREATE INDEX "events_createdById_idx" ON "events"("createdById");
CREATE INDEX "events_chairId_idx" ON "events"("chairId");
CREATE INDEX "events_projectId_idx" ON "events"("projectId");

CREATE TABLE "event_beneficiaries" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" "BeneficiaryCategory" NOT NULL,
    "note" TEXT,
    CONSTRAINT "event_beneficiaries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "event_beneficiaries_eventId_category_key" ON "event_beneficiaries"("eventId", "category");

CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "group" "ParticipantGroup" NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_participants_eventId_idx" ON "event_participants"("eventId");

CREATE TABLE "event_collaborators" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "orgType" "OrgType" NOT NULL DEFAULT 'OTHER',
    "orgName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    CONSTRAINT "event_collaborators_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_collaborators_eventId_idx" ON "event_collaborators"("eventId");

CREATE TABLE "event_expenses" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    CONSTRAINT "event_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_expenses_eventId_idx" ON "event_expenses"("eventId");

CREATE TABLE "event_photos" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "storagePath" TEXT NOT NULL,
    "thumbnailPath" TEXT,
    "driveFileId" TEXT,
    "driveFileUrl" TEXT,
    "syncStatus" "DriveSyncStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_photos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_photos_eventId_sortOrder_idx" ON "event_photos"("eventId", "sortOrder");

CREATE TABLE "event_documents" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL DEFAULT 'OTHER',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "label" TEXT,
    "storagePath" TEXT NOT NULL,
    "driveFileId" TEXT,
    "driveFileUrl" TEXT,
    "syncStatus" "DriveSyncStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_documents_eventId_category_idx" ON "event_documents"("eventId", "category");

CREATE TABLE "event_social_links" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    CONSTRAINT "event_social_links_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_social_links_eventId_idx" ON "event_social_links"("eventId");

-- ============================== REVIEW / AUDIT =============================
CREATE TABLE "event_reviews" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_reviews_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_reviews_eventId_idx" ON "event_reviews"("eventId");

CREATE TABLE "event_comments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_comments_eventId_idx" ON "event_comments"("eventId");

CREATE TABLE "event_status_history" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "from" "EventStatus",
    "to" "EventStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "event_status_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "event_status_history_eventId_idx" ON "event_status_history"("eventId");

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'GENERIC',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- ============================== GOOGLE DRIVE ===============================
CREATE TABLE "drive_folders" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "folderUrl" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "photosFolderId" TEXT,
    "posterFolderId" TEXT,
    "documentsFolderId" TEXT,
    "financialsFolderId" TEXT,
    "socialFolderId" TEXT,
    "reportFolderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drive_folders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drive_folders_eventId_key" ON "drive_folders"("eventId");

CREATE TABLE "drive_folder_cache" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drive_folder_cache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drive_folder_cache_path_key" ON "drive_folder_cache"("path");

CREATE TABLE "drive_files" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "folderId" TEXT,
    "driveFileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER,
    "webViewLink" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "drive_files_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "drive_files_eventId_idx" ON "drive_files"("eventId");

CREATE TABLE "drive_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "drive_credentials_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "drive_credentials_userId_key" ON "drive_credentials"("userId");

CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "kind" "ReportKind" NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "eventId" TEXT,
    "periodKey" TEXT,
    "filters" JSONB,
    "driveFileId" TEXT,
    "driveFileUrl" TEXT,
    "syncStatus" "DriveSyncStatus" NOT NULL DEFAULT 'PENDING',
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "generated_reports_kind_periodKey_idx" ON "generated_reports"("kind", "periodKey");

CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "targetId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "sync_jobs_completedAt_nextRunAt_idx" ON "sync_jobs"("completedAt", "nextRunAt");

-- ============================== FOREIGN KEYS ===============================
ALTER TABLE "users" ADD CONSTRAINT "users_boardPositionId_fkey" FOREIGN KEY ("boardPositionId") REFERENCES "board_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_avenueId_fkey" FOREIGN KEY ("avenueId") REFERENCES "avenues"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_avenueId_fkey" FOREIGN KEY ("avenueId") REFERENCES "avenues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_secretaryId_fkey" FOREIGN KEY ("secretaryId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "event_beneficiaries" ADD CONSTRAINT "event_beneficiaries_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "event_collaborators" ADD CONSTRAINT "event_collaborators_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_expenses" ADD CONSTRAINT "event_expenses_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_photos" ADD CONSTRAINT "event_photos_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_documents" ADD CONSTRAINT "event_documents_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_social_links" ADD CONSTRAINT "event_social_links_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_reviews" ADD CONSTRAINT "event_reviews_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_reviews" ADD CONSTRAINT "event_reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_comments" ADD CONSTRAINT "event_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_status_history" ADD CONSTRAINT "event_status_history_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_status_history" ADD CONSTRAINT "event_status_history_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "drive_folders" ADD CONSTRAINT "drive_folders_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "drive_files" ADD CONSTRAINT "drive_files_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "drive_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "drive_credentials" ADD CONSTRAINT "drive_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
