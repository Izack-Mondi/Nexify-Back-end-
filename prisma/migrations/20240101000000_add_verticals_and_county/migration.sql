-- Create Vertical enum
CREATE TYPE "Vertical" AS ENUM ('BUSINESS', 'AGRICULTURE', 'OPPORTUNITY');

-- Add county column to User
ALTER TABLE "User" ADD COLUMN "county" TEXT;

-- Add vertical column to Post with default BUSINESS for existing rows
ALTER TABLE "Post" ADD COLUMN "vertical" "Vertical" NOT NULL DEFAULT 'BUSINESS';

-- Create composite indexes
CREATE INDEX "Post_vertical_createdAt_id_idx" ON "Post"("vertical", "createdAt" DESC, "id");
CREATE INDEX "Post_createdAt_id_idx" ON "Post"("createdAt" DESC, "id");
CREATE INDEX "Post_authorId_createdAt_idx" ON "Post"("authorId", "createdAt" DESC);
