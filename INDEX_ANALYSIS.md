# Index Analysis for Feed Queries

## Current Post Model Indexes

```prisma
model Post {
  @@index([authorId])
  @@index([type])
  @@index([vertical, createdAt(sort: Desc), id])
  @@index([createdAt(sort: Desc), id])
  @@index([authorId, createdAt(sort: Desc)])
  @@index([productId])
  @@index([serviceId])
  @@index([offeringId])
}
```

## Query Analysis

### Tab = ALL
**Query pattern:**
- Filter by media readiness (complex OR conditions across mediaAsset, offering.demoAsset, product.mediaAsset)
- Exclude REJECTED posts
- Sort by `createdAt DESC, id DESC`
- Keyset pagination on (createdAt, id)

**Index used:** `@@index([createdAt(sort: Desc), id])`
- This is a perfect composite index for the main feed query
- Supports the ORDER BY clause efficiently
- No additional column needed

### Tab = BUSINESS or AGRICULTURE
**Query pattern:**
- Filter by `vertical = {BUSINESS|AGRICULTURE}`
- Filter by media readiness
- Exclude REJECTED posts
- Sort by `createdAt DESC, id DESC`
- Keyset pagination on (createdAt, id)

**Index used:** `@@index([vertical, createdAt(sort: Desc), id])`
- Perfect composite index for vertical-filtered queries
- Supports both the WHERE clause and ORDER BY
- Efficient for keyset pagination

### Author Visibility
**Query pattern:**
- When viewerId is provided: show author's own posts regardless of media status (except REJECTED)
- For others: only show posts with READY media
- This adds OR conditions on `authorId = viewerId`

**Index used:** `@@index([authorId, createdAt(sort: Desc)])`
- Supports filtering by authorId with pagination
- Helps when fetching author's own posts

## Recommendation: No `publishedAt` Column Needed

### Why `publishedAt` is not required:

1. **Current implementation works efficiently with `createdAt`**
   - The feed sorts by creation time, which is the natural ordering
   - Cursor-based pagination works correctly with (createdAt, id)
   - All existing indexes support the query patterns

2. **Author visibility doesn't require a separate column**
   - We handle author visibility at the query level using OR conditions
   - The status (PUBLISHED/PROCESSING) is computed in the application layer
   - No database column change needed

3. **Interleaving is in-memory, not database-level**
   - The interleave function reorders posts after fetching from the database
   - The cursor is built from the last database row (before interleaving)
   - This ensures pagination correctness without needing a separate visibility timestamp

4. **Performance is sufficient**
   - The existing composite indexes cover all query patterns
   - No N+1 queries are introduced
   - The interleaving algorithm is O(n) and runs on small page sizes (max 30)

### When `publishedAt` might be useful in the future:

1. **If we want editorial control over feed ranking**
   - To manually boost or demote posts without changing createdAt
   - To implement time-based visibility windows (e.g., show for 7 days, then hide)

2. **If we want to separate "created" from "published"**
   - For draft posts that become published later
   - For scheduled posts

3. **If we want to implement complex ranking algorithms**
   - Popularity scores that change over time
   - Machine learning-based ranking

### Conclusion

**Do not add a `publishedAt` column at this time.** The current schema with `createdAt` and the existing indexes is sufficient for the current requirements. The feed performance will be good with the current approach, and adding `publishedAt` would add complexity without clear benefits.

If future requirements change (e.g., editorial ranking, scheduled posts), we can add `publishedAt` then and migrate the data.
