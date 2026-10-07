import { BadRequestException } from '@nestjs/common';
import { FeedService } from './feed.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { MediaUrlSigner } from '../storage/media-url-signer.interface';

describe('FeedService view recording', () => {
  let feedService: FeedService;
  let prisma: any;
  let transaction: any;

  beforeEach(() => {
    transaction = {
      post: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'post-1',
          authorId: 'author-1',
          mediaAsset: { status: 'READY' },
          product: null,
          offering: null,
        }),
        update: jest.fn(),
      },
      postView: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    feedService = new FeedService(
      prisma as PrismaService,
      { publicUrl: (key: string) => key } as unknown as StorageService,
      { createPlaybackUrl: jest.fn() } as unknown as MediaUrlSigner,
    );
  });

  it('records a user view and increments the post count atomically', async () => {
    await expect(feedService.recordView('post-1', 'viewer-1')).resolves.toBe(true);

    expect(transaction.postView.createMany).toHaveBeenCalledWith({
      data: [{ postId: 'post-1', userId: 'viewer-1' }],
      skipDuplicates: true,
    });
    expect(transaction.post.update).toHaveBeenCalledWith({
      where: { id: 'post-1' },
      data: { viewsCount: { increment: 1 } },
    });
  });

  it('does not increment the count for a duplicate user/post view', async () => {
    transaction.postView.createMany.mockResolvedValue({ count: 0 });

    await expect(feedService.recordView('post-1', 'viewer-1')).resolves.toBe(false);

    expect(transaction.post.update).not.toHaveBeenCalled();
  });

  it('rejects views for missing posts', async () => {
    transaction.post.findUnique.mockResolvedValue(null);

    await expect(feedService.recordView('missing', 'viewer-1'))
      .rejects.toThrow(BadRequestException);
    expect(transaction.postView.createMany).not.toHaveBeenCalled();
  });

  it('does not allow another viewer to record a view of processing media', async () => {
    transaction.post.findUnique.mockResolvedValue({
      id: 'post-1',
      authorId: 'author-1',
      mediaAsset: { status: 'PROCESSING' },
      product: null,
      offering: null,
    });

    await expect(feedService.recordView('post-1', 'viewer-1'))
      .rejects.toThrow('not visible');
    expect(transaction.postView.createMany).not.toHaveBeenCalled();
  });

  it('allows the author to record a view of their own processing post', async () => {
    transaction.post.findUnique.mockResolvedValue({
      id: 'post-1',
      authorId: 'author-1',
      mediaAsset: { status: 'PROCESSING' },
      product: null,
      offering: null,
    });

    await expect(feedService.recordView('post-1', 'author-1')).resolves.toBe(true);
  });

  it('rejects views of posts with rejected media', async () => {
    transaction.post.findUnique.mockResolvedValue({
      id: 'post-1',
      authorId: 'author-1',
      mediaAsset: { status: 'REJECTED' },
      product: null,
      offering: null,
    });

    await expect(feedService.recordView('post-1', 'author-1'))
      .rejects.toThrow('not visible');
    expect(transaction.postView.createMany).not.toHaveBeenCalled();
  });
});
