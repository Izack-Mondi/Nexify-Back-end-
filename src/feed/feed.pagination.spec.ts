import { FeedService } from './feed.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { MediaUrlSigner } from '../storage/media-url-signer.interface';
import { FeedTab } from './feed.types';
import { Vertical } from '../common/vertical-assignment';

describe('FeedService pagination with interleaving', () => {
  let feedService: FeedService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      post: {
        findMany: jest.fn(),
      },
    };
    const storage = { publicUrl: (key: string) => `https://cdn.example/${key}` };
    const signer = { createPlaybackUrl: jest.fn() };
    feedService = new FeedService(
      prisma as PrismaService,
      storage as unknown as StorageService,
      signer as unknown as MediaUrlSigner,
    );
  });

  it('pages through all posts exactly once with no duplicates when tab = ALL', async () => {
    // Create 8 posts with mixed verticals
    const allPosts = [];
    const now = new Date('2026-01-01T00:00:00Z');
    
    for (let i = 0; i < 3; i++) {
      allPosts.push({
        id: `business-${i}`,
        authorId: 'user-1',
        type: 'GENERAL',
        vertical: Vertical.BUSINESS,
        caption: `Business post ${i}`,
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: 'TEXT',
        mediaAsset: null,
        offering: null,
        product: null,
        service: null,
        author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    for (let i = 0; i < 3; i++) {
      allPosts.push({
        id: `agriculture-${i}`,
        authorId: 'user-1',
        type: 'GENERAL',
        vertical: Vertical.AGRICULTURE,
        caption: `Agriculture post ${i}`,
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: 'TEXT',
        mediaAsset: null,
        offering: null,
        product: null,
        service: null,
        author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    for (let i = 0; i < 2; i++) {
      allPosts.push({
        id: `opportunity-${i}`,
        authorId: 'user-1',
        type: 'OPPORTUNITY',
        vertical: Vertical.OPPORTUNITY,
        caption: `Opportunity post ${i}`,
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: 'TEXT',
        mediaAsset: null,
        offering: null,
        product: null,
        service: null,
        author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Mock findMany to return all posts at once (single page)
    prisma.post.findMany.mockResolvedValue(allPosts);

    // Fetch single page
    const result = await feedService.getFeed(
      { first: 8, tab: FeedTab.ALL },
      'user-1'
    );

    // Verify no duplicates within the page
    const seenIds = new Set<string>();
    for (const edge of result.edges) {
      expect(seenIds.has(edge.node.id)).toBe(false);
      seenIds.add(edge.node.id);
    }

    // Verify all posts are present
    expect(result.edges.length).toBe(8);
    expect(seenIds.size).toBe(8);
    allPosts.forEach(post => {
      expect(seenIds.has(post.id)).toBe(true);
    });
  });

  it('cursor is built from the last database row, not the reordered position', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const posts = [
      {
        id: 'post-1',
        authorId: 'user-1',
        type: 'GENERAL',
        vertical: Vertical.BUSINESS,
        caption: 'Post 1',
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: 'TEXT',
        mediaAsset: null,
        offering: null,
        product: null,
        service: null,
        author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'post-2',
        authorId: 'user-1',
        type: 'GENERAL',
        vertical: Vertical.BUSINESS,
        caption: 'Post 2',
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: 'TEXT',
        mediaAsset: null,
        offering: null,
        product: null,
        service: null,
        author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'post-3',
        authorId: 'user-1',
        type: 'GENERAL',
        vertical: Vertical.AGRICULTURE,
        caption: 'Post 3',
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: 'TEXT',
        mediaAsset: null,
        offering: null,
        product: null,
        service: null,
        author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];

    prisma.post.findMany.mockResolvedValue(posts);

    const result = await feedService.getFeed(
      { first: 3, tab: FeedTab.ALL },
      'user-1'
    );

    // The cursor should be built from the last row fetched from the database (post-3)
    // even if interleaving reorders the display
    expect(result.pageInfo.endCursor).toBeDefined();
    
    // Decode the cursor to verify it's based on the last database row
    const decoded = feedService.decodeCursor(result.pageInfo.endCursor!);
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe('post-3'); // Last row from database before interleaving
  });

  it('does not interleave when tab is not ALL', async () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const posts = [
      {
        id: 'post-1',
        authorId: 'user-1',
        type: 'GENERAL',
        vertical: Vertical.BUSINESS,
        caption: 'Post 1',
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: 'TEXT',
        mediaAsset: null,
        offering: null,
        product: null,
        service: null,
        author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'post-2',
        authorId: 'user-1',
        type: 'GENERAL',
        vertical: Vertical.BUSINESS,
        caption: 'Post 2',
        mediaUrl: null,
        thumbnailUrl: null,
        mediaType: 'TEXT',
        mediaAsset: null,
        offering: null,
        product: null,
        service: null,
        author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        createdAt: now,
        updatedAt: now,
      },
    ];

    prisma.post.findMany.mockResolvedValue(posts);

    const result = await feedService.getFeed(
      { first: 2, tab: FeedTab.BUSINESS },
      'user-1'
    );

    // Should return posts in original order (no interleaving for non-ALL tabs)
    expect(result.edges[0].node.id).toBe('post-1');
    expect(result.edges[1].node.id).toBe('post-2');
  });
});
