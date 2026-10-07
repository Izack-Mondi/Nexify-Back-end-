import { FeedService } from './feed.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { MediaUrlSigner } from '../storage/media-url-signer.interface';
import { FeedTab } from './feed.types';

describe('FeedService cursor pagination', () => {
  let feedService: FeedService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      post: { findMany: jest.fn() },
    };
    feedService = new FeedService(
      prisma as PrismaService,
      { publicUrl: (key: string) => key } as unknown as StorageService,
      { createPlaybackUrl: jest.fn() } as unknown as MediaUrlSigner,
    );
  });

  it('uses returned cursors to continue keyset pagination', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    prisma.post.findMany
      .mockResolvedValueOnce([
        makePost('post-b', createdAt),
        makePost('post-a', createdAt),
      ])
      .mockResolvedValueOnce([makePost('post-a', createdAt)]);

    const firstPage = await feedService.getFeed({ first: 1 });
    const secondPage = await feedService.getFeed({
      first: 1,
      after: firstPage.pageInfo.endCursor,
    });

    expect(firstPage.edges.map(({ node }) => node.id)).toEqual(['post-b']);
    expect(secondPage.edges.map(({ node }) => node.id)).toEqual(['post-a']);
    expect(firstPage.pageInfo.hasNextPage).toBe(true);
    expect(secondPage.pageInfo.hasNextPage).toBe(false);

    const secondQuery = prisma.post.findMany.mock.calls[1][0];
    expect(secondQuery.where.OR).toEqual([
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: 'post-b' } },
    ]);
  });

  it('pages every All-feed post once even though each page is interleaved', async () => {
    const posts = [
      makePost('b4', new Date('2026-01-04T00:00:00.000Z'), 'BUSINESS'),
      makePost('b3', new Date('2026-01-03T00:00:00.000Z'), 'BUSINESS'),
      makePost('b2', new Date('2026-01-02T00:00:00.000Z'), 'BUSINESS'),
      makePost('a2', new Date('2026-01-01T12:00:00.000Z'), 'AGRICULTURE'),
      makePost('b1', new Date('2026-01-01T00:00:00.000Z'), 'BUSINESS'),
      makePost('a1', new Date('2025-12-30T00:00:00.000Z'), 'AGRICULTURE'),
      makePost('o1', new Date('2025-12-29T00:00:00.000Z'), 'OPPORTUNITY'),
    ];
    prisma.post.findMany.mockImplementation(async (query: any) => {
      const cursorFilter = query.where.OR as Array<Record<string, any>> | undefined;
      const afterId = cursorFilter?.[1]?.id?.lt;
      const startIndex = afterId
        ? posts.findIndex((post) => post.id === afterId) + 1
        : 0;
      return posts.slice(startIndex, startIndex + query.take);
    });

    const collectedIds: string[] = [];
    let after: string | undefined;
    let hasNextPage = true;
    while (hasNextPage) {
      const page = await feedService.getFeed({
        first: 4,
        after,
        tab: FeedTab.ALL,
      });
      collectedIds.push(...page.edges.map(({ node }) => node.id));
      after = page.pageInfo.endCursor;
      hasNextPage = page.pageInfo.hasNextPage;
    }

    expect(collectedIds).toHaveLength(posts.length);
    expect(new Set(collectedIds).size).toBe(posts.length);
    expect([...collectedIds].sort()).toEqual(posts.map((post) => post.id).sort());
    expect(prisma.post.findMany.mock.calls[1][0].where.OR).toEqual([
      { createdAt: { lt: new Date('2026-01-01T12:00:00.000Z') } },
      {
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
        id: { lt: 'a2' },
      },
    ]);
  });

  it('does not interleave vertical-specific tabs', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    prisma.post.findMany.mockResolvedValue([
      makePost('b2', createdAt, 'BUSINESS'),
      makePost('b1', new Date('2025-12-31T00:00:00.000Z'), 'BUSINESS'),
    ]);

    const page = await feedService.getFeed({
      first: 10,
      tab: FeedTab.BUSINESS,
    });

    expect(page.edges.map(({ node }) => node.id)).toEqual(['b2', 'b1']);
  });

  it('rejects malformed cursors through the feed service', async () => {
    await expect(
      feedService.getFeed({ first: 10, after: 'not-a-valid-cursor' }),
    ).rejects.toThrow('Invalid cursor provided');
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });
});

function makePost(id: string, createdAt: Date, vertical = 'BUSINESS') {
  return {
    id,
    type: 'GENERAL',
    vertical,
    caption: null,
    mediaUrl: null,
    thumbnailUrl: null,
    mediaType: 'TEXT',
    mediaAsset: null,
    offering: null,
    product: null,
    service: null,
    author: {
      id: 'author-1',
      fullName: 'Feed Author',
      location: null,
      emailVerified: false,
      phoneVerified: false,
    },
    likesCount: 0,
    commentsCount: 0,
    viewsCount: 0,
    createdAt,
    updatedAt: createdAt,
  };
}
