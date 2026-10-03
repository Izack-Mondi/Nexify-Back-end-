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
  description: String
  skills: [String!]!
  yearsExperience: Int!
  startingPrice: Float
  priceUnit: String
  county: String
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

# Mutations
requestVideoUpload(input: RequestVideoUploadInput!): UploadUrlResponse!
requestImageUpload(input: RequestImageUploadInput!): UploadUrlResponse!
completeUpload(assetId: ID!): MediaAsset!
createServiceOffering(input: CreateServiceOfferingInput!): ID!

# Queries
mediaAsset(id: ID!): MediaAsset!
playback(postId: ID!): PlaybackResponse!
homeFeed(input: FeedInput!): FeedConnection!
```

`Post` feed results additionally include nullable `media: PostMedia` and `offering: PostServiceOffering`. Feed media fields contain thumbnail/preview URLs and metadata only; no HLS manifest key or playback URL is included. The `playback` query resolves the ready post asset lazily.

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

For deployed databases, use `prisma migrate deploy`. The current local migration directory contains the vertical and media incremental migrations, while the configured PostgreSQL database reports applied migrations `20260904000000_init` and `20260905203831_init` that are absent from this checkout. Reconcile/restore those baseline migration files before applying this checkout's migration chain to that database; do not baseline or reset a database containing user data to work around the mismatch.

## Playback URL Limitation

HLS manifests reference multiple segment files, so an individual pre-signed manifest URL does not secure the segment requests. For v1, processed HLS outputs use UUID-based storage paths served through the configured public CDN URL, and `MediaUrlSigner` returns that public URL. This is intentionally a replaceable boundary: a CDN worker or token-signing implementation can be introduced later without changing the GraphQL `playback` contract. Keep the bucket/CDN path private from broad listing and allow only object reads through the intended CDN configuration.
