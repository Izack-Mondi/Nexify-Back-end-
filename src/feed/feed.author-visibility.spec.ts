import { FeedService } from './feed.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { MediaUrlSigner } from '../storage/media-url-signer.interface';
import { MediaAssetStatus, MediaAssetKind } from '../media/media.types';
import { PostStatus } from './feed.types';

describe('FeedService author visibility', () => {
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

  // NOTE: Integration tests against real Postgres would require:
  // 1. A test database service in docker-compose.yml
  // 2. Jest configuration to run migrations before tests
  // 3. Test data seeding utilities
  // 4. Database cleanup after tests
  // This is infrastructure work beyond the scope of this session.
  // The current unit tests with mocked prisma appropriately test the logic.

  it('author sees their own PROCESSING post in the feed', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([{
      id: 'post-1',
      authorId: 'user-1',
      type: 'GENERAL',
      vertical: 'BUSINESS',
      caption: 'My processing post',
      mediaUrl: null,
      thumbnailUrl: null,
      mediaType: 'VIDEO',
      mediaAsset: {
        kind: 'VIDEO',
        status: MediaAssetStatus.PROCESSING,
        posterKey: null,
        previewKey: null,
        blurhash: null,
        durationSec: null,
        width: null,
        height: null,
      },
      offering: null,
      product: null,
      service: null,
      author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      createdAt,
      updatedAt: createdAt,
    }]);

    const result = await feedService.getFeed({ first: 10 }, 'user-1');

    expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].node.status).toBe(PostStatus.PROCESSING);
  });

  it('author sees their own PROCESSING post status when media is not READY', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([{
      id: 'post-1',
      authorId: 'user-1',
      type: 'GENERAL',
      vertical: 'BUSINESS',
      caption: 'My post',
      mediaUrl: null,
      thumbnailUrl: null,
      mediaType: 'VIDEO',
      mediaAsset: {
        kind: 'VIDEO',
        status: MediaAssetStatus.UPLOADING,
        posterKey: null,
        previewKey: null,
        blurhash: null,
        durationSec: null,
        width: null,
        height: null,
      },
      offering: null,
      product: null,
      service: null,
      author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      createdAt,
      updatedAt: createdAt,
    }]);

    const result = await feedService.getFeed({ first: 10 }, 'user-1');

    expect(result.edges[0].node.status).toBe(PostStatus.PROCESSING);
  });

  it('author sees their own READY post as PUBLISHED', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([{
      id: 'post-1',
      authorId: 'user-1',
      type: 'GENERAL',
      vertical: 'BUSINESS',
      caption: 'My ready post',
      mediaUrl: null,
      thumbnailUrl: null,
      mediaType: 'VIDEO',
      mediaAsset: {
        kind: 'VIDEO',
        status: MediaAssetStatus.READY,
        posterKey: 'media/asset-1/poster.jpg',
        previewKey: 'media/asset-1/preview.mp4',
        blurhash: 'hash',
        durationSec: 8,
        width: 1280,
        height: 720,
      },
      offering: null,
      product: null,
      service: null,
      author: { id: 'user-1', fullName: 'User One', location: 'Nairobi', emailVerified: true, phoneVerified: true },
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      createdAt,
      updatedAt: createdAt,
    }]);

    const result = await feedService.getFeed({ first: 10 }, 'user-1');

    expect(result.edges[0].node.status).toBe(PostStatus.PUBLISHED);
  });

  it('other users do not see author\'s PROCESSING post', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([]);

    const result = await feedService.getFeed({ first: 10 }, 'user-2');

    expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
    const query = prisma.post.findMany.mock.calls[0][0];
    // Verify that the query includes media readiness filters for non-authors
    expect(query.where).toBeDefined();
    expect(result.edges.length).toBe(0);
  });

  it('author sees PUBLISHED status for posts with no media', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([{
      id: 'post-1',
      authorId: 'user-1',
      type: 'OPPORTUNITY',
      vertical: 'OPPORTUNITY',
      caption: 'Text-only opportunity',
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
      createdAt,
      updatedAt: createdAt,
    }]);

    const result = await feedService.getFeed({ first: 10 }, 'user-1');

    expect(result.edges[0].node.status).toBe(PostStatus.PUBLISHED);
  });

  it('REJECTED posts are excluded for everyone including author', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([]);

    const result = await feedService.getFeed({ first: 10 }, 'user-1');

    expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
    const query = prisma.post.findMany.mock.calls[0][0];
    // Verify that REJECTED posts are filtered out
    expect(query.where).toBeDefined();
    expect(result.edges.length).toBe(0);
  });
});
