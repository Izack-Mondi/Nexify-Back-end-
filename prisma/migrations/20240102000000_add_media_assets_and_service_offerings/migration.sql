-- Create MediaAssetKind enum
CREATE TYPE "MediaAssetKind" AS ENUM ('VIDEO', 'IMAGE');

-- Create MediaAssetStatus enum
CREATE TYPE "MediaAssetStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'REJECTED');

-- Create MediaAsset table
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "kind" "MediaAssetKind" NOT NULL,
    "status" "MediaAssetStatus" NOT NULL DEFAULT 'UPLOADING',
    "rejectionReason" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "storageKey" TEXT NOT NULL,
    "hlsManifestKey" TEXT,
    "posterKey" TEXT,
    "previewKey" TEXT,
    "blurhash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- Create indexes for MediaAsset
CREATE INDEX "MediaAsset_ownerId_createdAt_idx" ON "MediaAsset"("ownerId", "createdAt");
CREATE INDEX "MediaAsset_status_createdAt_idx" ON "MediaAsset"("status", "createdAt");

-- Create ServiceOffering table
CREATE TABLE "ServiceOffering" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "skills" TEXT[] NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "startingPrice" DOUBLE PRECISION,
    "priceUnit" TEXT,
    "county" TEXT,
    "demoAssetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOffering_pkey" PRIMARY KEY ("id")
);

-- Create index for ServiceOffering
CREATE INDEX "ServiceOffering_providerId_idx" ON "ServiceOffering"("providerId");

-- Add foreign key for MediaAsset owner
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key for ServiceOffering provider
ALTER TABLE "ServiceOffering" ADD CONSTRAINT "ServiceOffering_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add foreign key for ServiceOffering demoAsset
ALTER TABLE "ServiceOffering" ADD CONSTRAINT "ServiceOffering_demoAssetId_fkey" FOREIGN KEY ("demoAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add mediaAssetId to Product
ALTER TABLE "Product" ADD COLUMN "mediaAssetId" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add mediaAssetId to Post
ALTER TABLE "Post" ADD COLUMN "mediaAssetId" TEXT;
ALTER TABLE "Post" ADD CONSTRAINT "Post_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add offeringId to Post
ALTER TABLE "Post" ADD COLUMN "offeringId" TEXT;
ALTER TABLE "Post" ADD CONSTRAINT "Post_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ServiceOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Post_mediaAssetId_idx" ON "Post"("mediaAssetId");
CREATE INDEX "Post_offeringId_idx" ON "Post"("offeringId");

