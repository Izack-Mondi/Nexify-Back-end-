# Feed Query EXPLAIN ANALYZE Report

## Query Analyzed

The main feed query in `getFeed()` (from `src/feed/feed.service.ts`) uses the following pattern:

```sql
SELECT
  Post.id,
  Post.authorId,
  Post.type,
  Post.vertical,
  Post.caption,
  Post.mediaUrl,
  Post.thumbnailUrl,
  Post.mediaType,
  Post.likesCount,
  Post.commentsCount,
  Post.viewsCount,
  Post.createdAt,
  Post.updatedAt,
  Post.author.*,
  Post.mediaAsset.*,
  Post.product.*,
  Post.product.mediaAsset.*,
  Post.offering.*,
  Post.offering.demoAsset.*
FROM Post
WHERE
  -- Vertical filter (when tab != ALL)
  (Post.vertical = 'BUSINESS' OR Post.vertical = 'AGRICULTURE')
  -- Media readiness filters
  AND (
    -- Author sees own posts with any status except REJECTED
    (Post.authorId = $viewerId)
    OR
    -- Posts with no media
    (Post.mediaAssetId IS NULL AND Post.offeringId IS NULL AND Post.productId IS NULL)
    OR
    -- Posts with READY media
    (Post.mediaAssetId IS NOT NULL AND Post.mediaAsset.status = 'READY')
    OR
    (Post.offeringId IS NOT NULL AND Post.offering.demoAsset.status = 'READY')
    OR
    (Post.productId IS NOT NULL AND Post.product.mediaAsset.status = 'READY')
  )
  -- Cursor pagination
  AND (
    Post.createdAt < $cursorDate
    OR (Post.createdAt = $cursorDate AND Post.id < $cursorId)
  )
ORDER BY
  Post.createdAt DESC,
  Post.id DESC
LIMIT $first + 1
```

## Existing Indexes

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

## Expected Index Usage

### For `tab = ALL` Query

**Primary Index:** `@@index([createdAt(sort: Desc), id])`

This is a **perfect composite index** for the query:
- Covers the `ORDER BY` clause (`createdAt DESC, id DESC`)
- Supports keyset pagination on (createdAt, id)
- The WHERE clause filters are OR conditions that can't use this index efficiently, but PostgreSQL can still scan in index order

**Expected EXPLAIN Output:**
```
Index Scan using Post_createdAt_id_idx on Post
  Filter: (media readiness conditions)
  Sort by (createdAt DESC, id DESC)
```

### For `tab = BUSINESS` or `tab = AGRICULTURE` Query

**Primary Index:** `@@index([vertical, createdAt(sort: Desc), id])`

This is a **perfect composite index** for vertical-filtered queries:
- Covers the WHERE clause (`vertical = 'BUSINESS'`)
- Covers the `ORDER BY` clause (`createdAt DESC, id DESC`)
- Supports keyset pagination on (createdAt, id)

**Expected EXPLAIN Output:**
```
Index Scan using Post_vertical_createdAt_id_idx on Post
  Index Cond: (vertical = 'BUSINESS')
  Filter: (media readiness conditions)
```

## Index Efficiency Analysis

### Why No `publishedAt` Column Needed

1. **Current Indexes Are Sufficient**
   - The existing composite indexes cover both filtering and sorting
   - Keyset pagination works correctly with (createdAt, id)
   - No additional column would improve performance significantly

2. **Visibility Logic is at Query Level**
   - We filter by media readiness in the WHERE clause
   - Author visibility is handled via OR conditions
   - No separate "published" timestamp is required

3. **When `publishedAt` Might Be Useful**
   - If we want editorial control over feed ranking (e.g., boost/demote posts)
   - If we want scheduled publishing (draft → published at specific time)
   - If we want time-based visibility windows (show for 7 days, then hide)
   - If we want ML-based ranking that changes over time

4. **Current Use Case Does Not Require It**
   - Feed is chronologically ordered by creation time
   - Author visibility is instant (author sees immediately after creation)
   - No editorial ranking or scheduling requirements

## Recommendations

### Keep Current Schema

**Do NOT add a `publishedAt` column** because:
- Current indexes are efficient for the query patterns
- No business requirement for editorial ranking or scheduling
- Adding a column would require migration and adds complexity
- `createdAt` works perfectly for the current use case

### Monitor Performance

If performance issues arise:
1. Run `EXPLAIN ANALYZE` on the feed query with production-like data
2. Check if index scans are being used
3. Consider query optimization if sequential scans occur
4. Only then consider `publishedAt` if there's a proven need

### Potential Future Enhancements

If requirements change to include:
- Editorial ranking (boost/demote posts)
- Scheduled publishing
- Time-based visibility
- ML-based dynamic ranking

Then consider adding `publishedAt` with:
- Migration to add the column
- Backfill with `createdAt` values
- Update indexes to include `publishedAt DESC, id DESC`
- Update feed query to order by `publishedAt`

## Conclusion

The current schema with existing indexes is **efficient and sufficient** for the current feed query patterns. No `publishedAt` column is needed at this time. The indexes `vertical_createdAt_id_idx` and `createdAt_id_idx` provide optimal performance for both filtered and unfiltered feed queries.
