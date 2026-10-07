# Nexify Backend

NestJS 12 GraphQL API and separate BullMQ worker for Nexify media uploads and feeds.

## Media GraphQL API

Authenticated operations:

```graphql
input RequestVideoUploadInput {
  contentType: String!
  sizeBytes: Int!
}

input RequestImageUploadInput {
  contentType: String!
  sizeBytes: Int!
}

enum MediaAssetKind { VIDEO IMAGE }
enum MediaAssetStatus { UPLOADING PROCESSING READY REJECTED }

type UploadUrlResponse {
  assetId: ID!
  uploadUrl: String!
  expiresAt: DateTime!
  maxSizeBytes: Int!
  maxDurationSec: Int!
}

type MediaAsset {
  id: ID!
  kind: MediaAssetKind!
  status: MediaAssetStatus!
  rejectionReason: String
  mimeType: String!
  sizeBytes: Int!
  durationSec: Float
  width: Int
  height: Int
  createdAt: DateTime!
  updatedAt: DateTime!
}

type PostMedia {
  kind: MediaAssetKind!
  thumbnailUrl: String!
  previewUrl: String!
  blurhash: String!
  durationSec: Float
  width: Int
  height: Int
  hasVideo: Boolean!
}

input CreateServiceOfferingInput {
  title: String!
  category: String!
  vertical: PostVertical!
  description: String
  skills: [String!]!
  yearsExperience: Int!
  startingPrice: Float
  priceUnit: String
  county: String!
  demoAssetId: ID
}

type PostServiceOffering {
  id: ID!
  title: String!
  category: String!
  description: String
  skills: [String!]!
  yearsExperience: Int!
  startingPrice: Float
  priceUnit: String
  county: String
}

type PlaybackResponse {
  hlsUrl: String!
  durationSec: Float!
  expiresAt: DateTime!
}

enum PostStatus { PUBLISHED PROCESSING }

# Mutations
requestVideoUpload(input: RequestVideoUploadInput!): UploadUrlResponse!
requestImageUpload(input: RequestImageUploadInput!): UploadUrlResponse!
completeUpload(assetId: ID!): MediaAsset!
createServiceOffering(input: CreateServiceOfferingInput!): ID!
recordView(postId: ID!): Boolean!

# Queries
mediaAsset(id: ID!): MediaAsset!
playback(postId: ID!): PlaybackResponse!
homeFeed(input: FeedInput!): FeedConnection!
```

`Post` feed results additionally include `status: PostStatus!` (`PUBLISHED` or `PROCESSING`) and nullable `media: PostMedia` and `offering: PostServiceOffering`. Authors can see their own non-rejected posts while attached media is processing; other viewers only receive posts whose attached media is ready. Feed media fields contain thumbnail/preview URLs and metadata only; no HLS manifest key or playback URL is included. The `playback` query resolves the ready post asset lazily.

`recordView(postId)` records one view per authenticated user and post. It
returns `true` when the unique view is first recorded and the view count is
incremented, or `false` when that user already recorded a view. It is
rate-limited and rejects posts that are not visible to the caller.

Service offerings require a valid Kenyan county and an explicit `BUSINESS` or `AGRICULTURE` vertical. New post, product, service, and service-offering creation requires an `ACTIVE` account.

The `ALL` tab mixes the fetched page in memory to avoid more than two consecutive
cards of the same vertical when another vertical is available. Business and
Agriculture tabs retain their database order. Pagination cursors always come
from the last selected database row before the page is mixed.

The schema defines `Post_vertical_createdAt_id_idx` and
`Post_createdAt_id_idx` for feed filtering/order. Their use has not been
confirmed with `EXPLAIN`: this checkout has no configured `DATABASE_URL`,
`psql`, or Docker CLI, so a seeded local PostgreSQL plan could not be run.
A `publishedAt` column may be worthwhile at scale to simplify READY visibility
filtering and support a published-feed index, but should be measured with
`EXPLAIN (ANALYZE, BUFFERS)` against representative local seed data before
adding a schema migration. The current relationship-based READY conditions and
the author-only processing branch still need their own visibility predicates.

## Flutter Upload Sequence

1. Call `requestVideoUpload` with the MIME type and exact byte size, or `requestImageUpload` for an image. Video MIME types are `video/mp4`, `video/quicktime`, and `video/webm`.
2. Send the raw file bytes with HTTP `PUT` to the returned `uploadUrl`, preserving the requested `Content-Type` and `Content-Length`.
3. Call `completeUpload(assetId: ...)` after the PUT succeeds.
4. Poll `mediaAsset(id: ...)` until `READY` or `REJECTED`. An offering may be created while its demo is `PROCESSING`; its feed post remains hidden until the asset is ready.
5. Call `createServiceOffering` with the returned asset ID.
6. Load the regular authenticated `homeFeed`; it contains poster, preview, blurhash, and video metadata, but never HLS URLs.
7. When the user taps the video card, call `playback(postId: ...)` and play its HLS URL.

Images are processed and marked `READY` by `completeUpload`; videos are processed asynchronously by the separate worker. The server uses ffprobe rather than client duration metadata and rejects videos at or beyond the 601-second boundary for the default 600-second maximum.

## Environment

Local development defaults (no cloud account required):

```dotenv
STORAGE_DRIVER=local
LOCAL_STORAGE_DIR=./storage
LOCAL_STORAGE_PUBLIC_URL=http://localhost:3000/storage
LOCAL_UPLOAD_SECRET=replace-with-a-long-random-local-secret
REDIS_HOST=localhost
REDIS_PORT=6379
MAX_VIDEO_BYTES=314572800
MAX_VIDEO_DURATION_SEC=600
MAX_IMAGE_BYTES=10485760
MAX_CONCURRENT_UPLOADS=5
UPLOAD_URL_EXPIRES_IN=3600
VIDEO_PROCESSING_TIMEOUT_MS=900000
TEMP_DIR=./temp
```

For R2, set `STORAGE_DRIVER=r2` and provide `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, and `R2_PUBLIC_BASE_URL`. Use an unguessable public bucket path and configure its CDN/public-read policy for processed `media/` outputs. Never make the original `uploads/` path public.

`docker compose up --build` starts PostgreSQL, Redis, the API, and a worker image containing ffmpeg/ffprobe. For its isolated development database, the API runs `prisma db push` before starting, because this checkout does not include the historical base-table migrations. The worker and API share the mounted local media directory.

### Production migration reconciliation

The migration chain in this checkout cannot currently be confirmed as consistent
with the Render production database. This checkout contains only the
`20240101000000_add_verticals_and_county` and
`20240102000000_add_media_assets_and_service_offerings` incremental migrations,
plus `20261007000000_add_post_views`.
The production migration history is reported to include
`20260904000000_init` and `20260905203831_init`, whose baseline files are absent
here, and the Render production schema is currently missing the `MediaAsset`
table. Do not run `prisma migrate deploy` against production until the history
and actual schema have been reconciled.

Use this forward-only procedure:

1. Restore the exact missing baseline migration files from their source of
   truth. Compare their names and checksums with the production
   `_prisma_migrations` records; do not reconstruct or edit applied migrations
   by guesswork.
2. Using read-only production credentials, capture `prisma migrate status`,
   the relevant `_prisma_migrations` rows, and a schema-only inventory of the
   tables, columns, indexes, enums, and foreign keys expected by the two
   incremental migrations. Keep connection strings and credentials out of
   logs, reports, and source control.
3. Compare that inventory to the restored baseline and incremental SQL. Confirm
   whether the two `202401...` migrations are genuinely unapplied and safe to
   run after the recovered `202609...` baselines, then determine whether the
   `20261007000000_add_post_views` migration can safely follow them. Do not mark
   migrations as applied merely to suppress pending status.
4. Rehearse the reconciled chain on a disposable local database restored from a
   production schema/data backup. Verify that applying the pending migrations
   creates `MediaAsset` and its relations/indexes without destructive changes.
5. After review and an approved production backup/maintenance window, apply only
   the verified forward migrations with `prisma migrate deploy`. Do not use
   `prisma db push`, `migrate reset`, destructive SQL, or an artificial
   baselining step against production.
6. Verify the production migration records and `MediaAsset` schema after
   deployment, then smoke-test media upload and feed queries without exposing
   secrets or modifying existing user data.

## Playback URL Limitation

HLS manifests reference multiple segment files, so an individual pre-signed manifest URL does not secure the segment requests. For v1, processed HLS outputs use UUID-based storage paths served through the configured public CDN URL, and `MediaUrlSigner` returns that public URL. This is intentionally a replaceable boundary: a CDN worker or token-signing implementation can be introduced later without changing the GraphQL `playback` contract. Keep the bucket/CDN path private from broad listing and allow only object reads through the intended CDN configuration.
