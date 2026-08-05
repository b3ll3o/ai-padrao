-- CreateEnum
CREATE TYPE "AuditOp" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- AlterTable: add deletedAt + version to users
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateTable: users_history
CREATE TABLE "users_history" (
    "id" TEXT NOT NULL,
    "original_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "operation" "AuditOp" NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "users_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "users_history_original_id_version_idx" ON "users_history"("original_id", "version");
CREATE INDEX "users_history_changed_at_idx" ON "users_history"("changed_at");

ALTER TABLE "users_history" ADD CONSTRAINT "users_history_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one CREATE history entry per existing user.
-- Wrapped so the migration fails atomically if backfill fails.
DO $$
DECLARE
  u RECORD;
  snap JSONB;
BEGIN
  FOR u IN SELECT id, email, name, password_hash, role, created_at, updated_at FROM users LOOP
    snap := jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'name', u.name,
      'passwordHash', u.password_hash,
      'role', u.role,
      'createdAt', u.created_at,
      'updatedAt', u.updated_at,
      'deletedAt', NULL,
      'version', 0
    );
    INSERT INTO users_history (id, original_id, version, operation, changed_at, snapshot)
    VALUES (gen_random_uuid()::text, u.id, 0, 'CREATE', u.created_at, snap);
  END LOOP;
END $$;