import { UnauthorizedException } from '@nestjs/common';
import { FeedService } from './feed.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { MediaUrlSigner } from '../storage/media-url-signer.interface';

describe('FeedService media behavior', () => {
  let feedService: FeedService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      post: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      product: { findUnique: jest.fn() },
      service: { findUnique: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ status: 'ACTIVE' }) },
      mediaAsset: { findUnique: jest.fn() },
    };
    const storage = { publicUrl: (key: string) => `https://cdn.example/${key}` };
    const signer = { createPlaybackUrl: jest.fn() };
    feedService = new FeedService(
      prisma as PrismaService,
      storage as unknown as StorageService,
      signer as unknown as MediaUrlSigner,
    );
  });

  it('fetches each page in one Prisma call and never exposes HLS keys', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([{
      id: 'post-1',
      authorId: 'user-1',
      type: 'GENERAL',
      vertical: 'BUSINESS',
      caption: 'Demo',
      mediaUrl: null,
      thumbnailUrl: null,
      mediaType: 'VIDEO',
      mediaAsset: {
        kind: 'VIDEO',
        status: 'READY',
        posterKey: 'media/asset-1/poster.jpg',
        previewKey: 'media/asset-1/preview.mp4',
        blurhash: 'hash',
        durationSec: 8,
        width: 1280,
        height: 720,
        hlsManifestKey: 'secret/manifest.m3u8',
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

    const result = await feedService.getFeed({ first: 10 });
    const query = prisma.post.findMany.mock.calls[0][0];

    expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
    expect(query.take).toBe(11);
    expect(JSON.stringify(query.where)).toContain('"status":"READY"');
    expect(result.edges[0].node.media).toMatchObject({
      thumbnailUrl: 'https://cdn.example/media/asset-1/poster.jpg',
      previewUrl: 'https://cdn.example/media/asset-1/preview.mp4',
      hasVideo: true,
    });
    expect(result.edges[0].node.status).toBe('PUBLISHED');
    expect(JSON.stringify(result)).not.toContain('hlsManifestKey');
    expect(JSON.stringify(result)).not.toContain('secret/manifest.m3u8');
  });

  it('includes an author-owned processing post with PROCESSING status', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([{
      id: 'post-processing',
      authorId: 'viewer-1',
      type: 'GENERAL',
      vertical: 'BUSINESS',
      caption: 'Preparing video',
      mediaUrl: null,
      thumbnailUrl: null,
      mediaType: 'VIDEO',
      mediaAsset: { kind: 'VIDEO', status: 'PROCESSING' },
      offering: {
        id: 'offering-1',
        title: 'Irrigation installation',
        category: 'irrigation',
        description: 'Demo',
        skills: [],
        yearsExperience: 3,
        startingPrice: null,
        priceUnit: null,
        county: 'Nairobi',
        demoAsset: { status: 'PROCESSING' },
      },
      product: null,
      service: null,
      author: {
        id: 'viewer-1',
        fullName: 'Viewer',
        location: null,
        emailVerified: false,
        phoneVerified: false,
      },
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      createdAt,
      updatedAt: createdAt,
    }]);

    const result = await feedService.getFeed({ first: 10 }, 'viewer-1');
    const query = prisma.post.findMany.mock.calls[0][0];

    expect(JSON.stringify(query.where)).toContain('"authorId":"viewer-1"');
    expect(JSON.stringify(query.where)).toContain('"REJECTED"');
    expect(result.edges[0].node.status).toBe('PROCESSING');
    expect(result.edges[0].node.media).toBeUndefined();
    expect(result.edges[0].node.offering?.title).toBe('Irrigation installation');
  });

  it('does not return processing posts for another viewer', async () => {
    prisma.post.findMany.mockResolvedValue([]);

    const result = await feedService.getFeed({ first: 10 }, 'viewer-2');
    const query = prisma.post.findMany.mock.calls[0][0];

    expect(JSON.stringify(query.where)).toContain('"authorId":"viewer-2"');
    expect(result.edges).toEqual([]);
  });

  it('marks posts with no media as PUBLISHED', async () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    prisma.post.findMany.mockResolvedValue([{
      id: 'text-post',
      authorId: 'user-1',
      type: 'OPPORTUNITY',
      vertical: 'OPPORTUNITY',
      caption: 'Text opportunity',
      mediaUrl: null,
      thumbnailUrl: null,
      mediaType: 'TEXT',
      mediaAsset: null,
      offering: null,
      product: null,
      service: null,
      author: {
        id: 'user-1',
        fullName: 'Author',
        location: null,
        emailVerified: false,
        phoneVerified: false,
      },
      likesCount: 0,
      commentsCount: 0,
      viewsCount: 0,
      createdAt,
      updatedAt: createdAt,
    }]);

    const result = await feedService.getFeed({ first: 10 }, 'user-1');

    expect(result.edges[0].node.status).toBe('PUBLISHED');
  });

  it('rejects attaching another user\'s media asset to a post', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      ownerId: 'user-a',
      status: 'READY',
    });

    await expect(feedService.createPost({
      authorId: 'user-b',
      type: 'GENERAL',
      mediaAssetId: 'asset-1',
    })).rejects.toThrow(UnauthorizedException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('rejects post creation for a non-active account', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: 'PENDING' });

    await expect(feedService.createPost({
      authorId: 'user-pending',
      type: 'GENERAL',
    })).rejects.toThrow('active account');
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('rejects attaching a product owned by another user', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'product-1',
      sellerId: 'user-a',
      category: 'crops',
    });

    await expect(feedService.createPost({
      authorId: 'user-b',
      type: 'MARKETPLACE',
      productId: 'product-1',
    })).rejects.toThrow(UnauthorizedException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('rejects attaching a service owned by another user', async () => {
    prisma.service.findUnique.mockResolvedValue({
      id: 'service-1',
      providerId: 'user-a',
      category: 'irrigation',
    });

    await expect(feedService.createPost({
      authorId: 'user-b',
      type: 'SERVICE',
      serviceId: 'service-1',
    })).rejects.toThrow(UnauthorizedException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });

  it('uses service category when assigning a post vertical', async () => {
    prisma.service.findUnique.mockResolvedValue({
      id: 'service-1',
      providerId: 'user-a',
      category: 'irrigation',
    });
    prisma.post.create.mockResolvedValue({ id: 'post-1' });

    await feedService.createPost({
      authorId: 'user-a',
      type: 'SERVICE',
      serviceId: 'service-1',
    });

    expect(prisma.post.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ vertical: 'AGRICULTURE' }),
    }));
  });

  it('restricts post contacts to active viewers and published posts', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    prisma.post.findUnique.mockResolvedValue({
      author: {
        id: 'author-1',
        fullName: 'Post Author',
        phoneNumber: '+254700000000',
      },
      mediaAsset: { status: 'PROCESSING' },
      product: null,
      offering: null,
    });

    await expect(feedService.getPostContact('post-1', 'viewer-1'))
      .rejects.toThrow('unpublished post');

    prisma.user.findUnique.mockResolvedValue({ status: 'PENDING' });
    await expect(feedService.getPostContact('post-1', 'viewer-1'))
      .rejects.toThrow('active account');
    expect(prisma.post.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns contact details for a published post to an active viewer', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    prisma.post.findUnique.mockResolvedValue({
      author: {
        id: 'author-1',
        fullName: 'Post Author',
        phoneNumber: '+254700000000',
      },
      mediaAsset: null,
      product: null,
      offering: null,
    });

    await expect(feedService.getPostContact('post-1', 'viewer-1'))
      .resolves.toEqual({
        id: 'author-1',
        fullName: 'Post Author',
        phoneNumber: '+254700000000',
      });
  });
});
