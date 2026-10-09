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
        create: jest.fn(),
      },
      product: { findUnique: jest.fn() },
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

    const result = await (feedService as any).getFeed({ first: 10 }, 'user-1');
    const query = prisma.post.findMany.mock.calls[0][0];

    expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
    expect(query.take).toBe(11);
    expect(JSON.stringify(query.where)).toContain('"status":"READY"');
    expect(result.edges[0].node.media).toMatchObject({
      thumbnailUrl: 'https://cdn.example/media/asset-1/poster.jpg',
      previewUrl: 'https://cdn.example/media/asset-1/preview.mp4',
      hasVideo: true,
    });
    expect(JSON.stringify(result)).not.toContain('hlsManifestKey');
    expect(JSON.stringify(result)).not.toContain('secret/manifest.m3u8');
  });

  it('rejects attaching another user\'s media asset to a post', async () => {
    prisma.mediaAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      ownerId: 'user-a',
      status: 'READY',
    });

    await expect((feedService as any).createPost({
      authorId: 'user-b',
      type: 'GENERAL',
      mediaAssetId: 'asset-1',
    })).rejects.toThrow(UnauthorizedException);
    expect(prisma.post.create).not.toHaveBeenCalled();
  });
});