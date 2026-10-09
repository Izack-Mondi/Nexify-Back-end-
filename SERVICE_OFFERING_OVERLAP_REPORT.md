# Service vs ServiceOffering Overlap Report

## Executive Summary

The Nexify backend contains two models for services: the legacy `Service` model and the newer `ServiceOffering` model. This report documents their overlap and provides recommendations.

## Model Comparison

### Legacy Service Model (`prisma/schema.prisma` lines 157-181)

```prisma
model Service {
  id              String   @id @default(uuid())
  name            String
  description     String?
  category        String
  location        String?
  price           String?
  availability    String?
  experience      String?
  mediaUrl        String?
  thumbnailUrl    String?
  mediaType       String   @default("IMAGE")
  providerId      String
  provider        User     @relation(fields: [providerId], references: [id], onDelete: Cascade)
  rating          Float    @default(0)
  reviews         Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  posts           Post[]

  @@index([providerId])
  @@index([category])
  @@index([createdAt])
}
```

**Features:**
- Basic service listing with name, description, category, location
- Simple pricing (string field)
- Availability and experience (text fields)
- Media support (single image/video URL)
- Rating and review counts
- Links to `Post` via `serviceId`

**Limitations:**
- No demo video support (no HLS, no poster/preview/blurhash)
- No county field
- No skills array
- No yearsExperience (only text `experience`)
- No title separate from name
- No explicit vertical assignment (relies on `assignVertical` from category)
- No integration with MediaAsset table

### New ServiceOffering Model (`prisma/schema.prisma` lines 107-127)

```prisma
model ServiceOffering {
  id               String      @id @default(uuid())
  providerId       String
  provider         User        @relation(fields: [providerId], references: [id], onDelete: Cascade)
  title            String
  category         String
  description      String?
  skills           String[]
  yearsExperience  Int
  startingPrice    Float?
  priceUnit        String?
  county           String?
  demoAssetId      String?
  demoAsset        MediaAsset? @relation(fields: [demoAssetId], references: [id], onDelete: SetNull)
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt

  posts            Post[]

  @@index([providerId])
}
```

**Features:**
- Rich service offering with title (separate from name)
- Category and description
- Skills array for showcasing expertise
- Numeric `yearsExperience` field
- Structured pricing with `startingPrice` (float) and `priceUnit`
- County field for Kenyan counties
- **Demo video support** via `demoAssetId` linking to MediaAsset table
- Full integration with video pipeline (HLS, poster, preview, blurhash)
- **Explicit vertical assignment** (BUSINESS or AGRICULTURE) chosen by user
- Transactional creation with Post (atomic operation)

**Advantages over Service:**
- Demo videos for showcasing services
- Better structured data (numeric years, array of skills)
- County-based filtering
- Explicit vertical control
- Full MediaAsset integration
- Atomic post creation

## Overlap Analysis

### Shared Fields
- `id`, `providerId`, `provider` (User relation)
- `category`, `description`, `location`
- `price` (though Service uses string, ServiceOffering uses structured float + unit)
- `mediaUrl`, `thumbnailUrl`, `mediaType` (Service has these directly; ServiceOffering uses MediaAsset)

### Database Relationships
- Both link to `User` via `providerId`
- Both link to `Post` (Service via `serviceId`, ServiceOffering via `offeringId`)
- ServiceOffering additionally links to `MediaAsset` via `demoAssetId`

### Post Model References
```prisma
model Post {
  // ...
  serviceId     String?
  service       Service?         @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  offeringId    String?
  offering      ServiceOffering? @relation(fields: [offeringId], references: [id], onDelete: SetNull)
  // ...
}
```

The Post model can reference **either** `Service` (legacy) **or** `ServiceOffering` (new), allowing for backward compatibility.

## Recommendation

### Keep Both Models (For Now)

**Rationale:**
1. **Backward Compatibility**: Existing posts reference `Service` via `serviceId`. Removing the model would break these posts.
2. **Data Migration Risk**: Migrating legacy services to ServiceOffering would require:
   - Mapping string price to structured startingPrice + priceUnit
   - Parsing text experience to numeric yearsExperience
   - Adding skills array (may not have data)
   - Creating MediaAsset records for existing media
   - Updating all Post references
3. **Transition Period**: Users may still have legacy services that haven't been re-created.

### Path Forward

1. **Mark Service as Deprecated**: Add a comment in schema indicating Service is legacy.
2. **Migrate Creation Path**: New service creations should use `createServiceOffering` instead of `createService`.
3. **Optional Data Migration**: Eventually provide a migration script to convert legacy Services to ServiceOfferings.
4. **Deprecate createService Mutation**: Once all services are migrated, remove the mutation.

### Immediate Action
- **Do not remove Service model**
- **Do not remove createService mutation**
- **Use ServiceOffering for all new features** (already done in Phase 2)
- **Keep Service for backward compatibility**

## Conclusion

The ServiceOffering model is the intended path forward with superior features (demo videos, explicit verticals, structured data). The Service model is legacy but must be preserved for backward compatibility with existing posts. No immediate removal is required; instead, gradually migrate usage to ServiceOffering over time.
