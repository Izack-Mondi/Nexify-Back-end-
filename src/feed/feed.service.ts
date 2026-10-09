import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { FeedInput, FeedConnection, PostEdge, PageInfo, PostType, FeedTab, PostMedia, PostServiceOffering, PlaybackResponse, PostStatus } from './feed.types';
import { assignVertical, Vertical } from '../common/vertical-assignment';
import { MediaAssetStatus, MediaAssetKind } from '../media/media.types';
import { MediaUrlSigner } from '../storage/media-url-signer.interface';
import { interleavePosts } from './feed.interleave';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly mediaUrlSigner: MediaUrlSigner,
  ) {
    this.logger = new Logger(FeedService.name);
  }

  public encodeCursor(id: string, createdAt: Date): string {
    const cursorData = {
      v: 1,
      c: createdAt.getTime(),
      i: id,
    };
    return Buffer.from(JSON.stringify(cursorData)).toString('base64url');
  }

  private computePostStatus(post: any, viewerId?: string): PostStatus {
    // For the author's own posts, check if any media is still processing
    if (viewerId && post.authorId === viewerId) {
      const mediaAsset = post.mediaAsset ?? post.product?.mediaAsset ?? post.offering?.demoAsset;
      if (mediaAsset && mediaAsset.status !== MediaAssetStatus.READY) {
        return PostStatus.PROCESSING;
      }
    }
    
    // For all other cases, if media exists and is not READY, it won't be in the feed
    // (filtered out by the query), so we only see PUBLISHED posts
    return PostStatus.PUBLISHED;
  }

  public decodeCursor(cursor: string): { id: string; createdAt: number } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
      const cursorData = JSON.parse(decoded);
      
      if (cursorData.v !== 1) {
        return null;
      }
      
      return { id: cursorData.i, createdAt: cursorData.c };
    } catch (error) {
      this.logger.error(`Failed to decode cursor: ${error}`);
      return null;
    }
  }

  public async getFeed(input: FeedInput, viewerId?: string): Promise<FeedConnection> {
    const first = input.first ?? 10;
    const after = input.after;
    const type = input.type;
    const tab = input.tab ?? FeedTab.ALL;

    this.logger.log(`Fetching feed with first=${first}, after=${after}, type=${type}, tab=${tab}, viewerId=${viewerId}`);

    // Validate pagination limits
    if (first < 1 || first > 30) {
      throw new Error('first must be between 1 and 30');
    }

    // Build where clause
    const where: any = {};
    
    // Use tab if provided, otherwise fall back to deprecated type field
    if (tab && tab !== FeedTab.ALL) {
      where.vertical = tab;
    } else if (type) {
      // Deprecated: only use type if tab is not provided
      where.type = type;
    }

    // Decode cursor if provided
    let cursorFilter: any = {};
    if (after) {
      const decoded = this.decodeCursor(after);
      if (!decoded) {
        throw new Error('Invalid cursor provided');
      }
      const cursorDate = new Date(decoded.createdAt);
      cursorFilter = {
        OR: [
          { createdAt: { lt: cursorDate } },
          { createdAt: cursorDate, id: { lt: decoded.id } },
        ],
      };
    }

    // Build media readiness filters
    // For the author: show posts with any status except REJECTED
    // For others: only show posts with READY media or no media
    const mediaReadinessFilters: any[] = [];

    if (viewerId) {
      // Author sees their own posts with any status except REJECTED
      mediaReadinessFilters.push({
        OR: [
          { authorId: viewerId },
          {
            AND: [
              { mediaAssetId: null },
              { offeringId: null },
              { productId: null },
            ],
          },
          {
            AND: [
              { mediaAssetId: { not: null } },
              { mediaAsset: { is: { status: MediaAssetStatus.READY } } },
            ],
          },
          {
            AND: [
              { offeringId: { not: null } },
              {
                offering: {
                  is: {
                    OR: [
                      { demoAssetId: null },
                      { demoAsset: { is: { status: MediaAssetStatus.READY } } },
                    ],
                  },
                },
              },
            ],
          },
          {
            AND: [
              { productId: { not: null } },
              {
                product: {
                  is: {
                    OR: [
                      { mediaAssetId: null },
                      { mediaAsset: { is: { status: MediaAssetStatus.READY } } },
                    ],
                  },
                },
              },
            ],
          },
        ],
      });
    } else {
      // Others only see posts with READY media or no media
      mediaReadinessFilters.push({
        OR: [
          { mediaAssetId: null },
          { mediaAsset: { is: { status: MediaAssetStatus.READY } } },
        ],
      });
      mediaReadinessFilters.push({
        OR: [
          { offeringId: null },
          {
            offering: {
              is: {
                OR: [
                  { demoAssetId: null },
                  { demoAsset: { is: { status: MediaAssetStatus.READY } } },
                ],
              },
            },
          },
        ],
      });
      mediaReadinessFilters.push({
        OR: [
          { productId: null },
          {
            product: {
              is: {
                OR: [
                  { mediaAssetId: null },
                  { mediaAsset: { is: { status: MediaAssetStatus.READY } } },
                ],
              },
            },
          },
        ],
      });
    }

    // Exclude REJECTED posts for everyone
    const rejectionFilter = {
      NOT: [
        {
          mediaAsset: { is: { status: MediaAssetStatus.REJECTED } },
        },
        {
          offering: {
            is: {
              demoAsset: { is: { status: MediaAssetStatus.REJECTED } },
            },
          },
        },
        {
          product: {
            is: {
              mediaAsset: { is: { status: MediaAssetStatus.REJECTED } },
            },
          },
        },
      ],
    };

    // Fetch posts with pagination
    const posts = await this.prisma.post.findMany({
      where: {
        ...where,
        ...cursorFilter,
        AND: [
          ...mediaReadinessFilters,
          rejectionFilter,
        ],
      },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            location: true,
            emailVerified: true,
            phoneVerified: true,
          },
        },
        mediaAsset: true,
        offering: {
          include: {
            demoAsset: true,
          },
        },
        product: { include: { mediaAsset: true } },
        service: {
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            location: true,
            price: true,
            availability: true,
            experience: true,
            mediaUrl: true,
            thumbnailUrl: true,
            mediaType: true,
            rating: true,
            reviews: true,
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: first + 1, // Fetch one extra to determine if there's a next page
    });

    const hasNextPage = posts.length > first;
    let edges = hasNextPage ? posts.slice(0, first) : posts;

    // Build cursor from the last row fetched from the database (before interleaving)
    // This ensures pagination works correctly regardless of reordering
    const lastDbRow = edges.length > 0 ? edges[edges.length - 1] : null;
    const endCursor = lastDbRow ? this.encodeCursor(lastDbRow.id, lastDbRow.createdAt) : undefined;

    // Interleave posts when tab = ALL to mix verticals
    if (tab === FeedTab.ALL && edges.length > 2) {
      // Extract minimal data for interleaving
      const postsForInterleave = edges.map(post => ({
        id: post.id,
        vertical: post.vertical as Vertical,
        createdAt: post.createdAt,
      }));
      
      // Get interleaved order
      const interleaved = interleavePosts(postsForInterleave);
      
      // Reorder edges based on interleaved IDs
      const idToIndex = new Map<string, number>();
      interleaved.forEach((post, index) => idToIndex.set(post.id, index));
      
      edges = edges.sort((a, b) => {
        const indexA = idToIndex.get(a.id) ?? 0;
        const indexB = idToIndex.get(b.id) ?? 0;
        return indexA - indexB;
      });
    }

    // Create edges with cursors
    const postEdges: PostEdge[] = edges.map((post) => {
      let media: PostMedia | undefined;
      const mediaAsset = post.mediaAsset ?? post.product?.mediaAsset ?? post.offering?.demoAsset;
      if (mediaAsset && mediaAsset.status === MediaAssetStatus.READY) {
        media = {
          kind: mediaAsset.kind as any,
          thumbnailUrl: mediaAsset.posterKey ? this.storage.publicUrl(mediaAsset.posterKey) : '',
          previewUrl: mediaAsset.previewKey ? this.storage.publicUrl(mediaAsset.previewKey) : '',
          blurhash: mediaAsset.blurhash || '',
          durationSec: mediaAsset.durationSec,
          width: mediaAsset.width,
          height: mediaAsset.height,
          hasVideo: mediaAsset.kind === MediaAssetKind.VIDEO,
        };
      }

      let offering: PostServiceOffering | undefined;
      if (post.offering) {
        // Always include offering text fields regardless of media status
        // This allows author to see their PROCESSING posts with content
        offering = {
          id: post.offering.id,
          title: post.offering.title,
          category: post.offering.category,
          description: post.offering.description,
          skills: post.offering.skills,
          yearsExperience: post.offering.yearsExperience,
          startingPrice: post.offering.startingPrice,
          priceUnit: post.offering.priceUnit,
          county: post.offering.county,
        };
      }

      return {
        node: {
          id: post.id,
          author: {
            id: post.author.id,
            fullName: post.author.fullName,
            location: post.author.location,
            isVerified: post.author.emailVerified && post.author.phoneVerified,
          },
          type: post.type as any,
          vertical: post.vertical as Vertical,
          caption: post.caption,
          mediaUrl: post.mediaType === 'VIDEO' ? undefined : post.mediaUrl,
          thumbnailUrl: post.thumbnailUrl,
          mediaType: post.mediaType as any,
          media,
          offering,
          product: post.product ? {
            ...post.product,
            mediaUrl: post.product.mediaType === 'VIDEO' ? undefined : post.product.mediaUrl,
            mediaType: post.product.mediaType as any,
          } : undefined,
          service: post.service ? {
            ...post.service,
            mediaType: post.service.mediaType as any,
          } : undefined,
          status: this.computePostStatus(post, viewerId),
          likesCount: post.likesCount,
          commentsCount: post.commentsCount,
          viewsCount: post.viewsCount,
          createdAt: post.createdAt,
          updatedAt: post.updatedAt,
        },
        cursor: this.encodeCursor(post.id, post.createdAt),
      };
    });

    // Create page info
    // Use the pre-interleaved cursor to ensure pagination works correctly
    const pageInfo: PageInfo = {
      hasNextPage,
      endCursor,
    };

    return {
      edges: postEdges,
      pageInfo,
    };
  }

  public async createPost(data: {
    authorId: string;
    type: string;
    caption?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mediaType?: string;
    mediaAssetId?: string;
    productId?: string;
    serviceId?: string;
  }) {
    if (data.mediaAssetId) {
      await this.assertAssetCanBeAttached(data.authorId, data.mediaAssetId);
    }

    // Verify productId belongs to the caller
    if (data.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
        select: { category: true, sellerId: true },
      });
      if (!product) {
        throw new BadRequestException('Product not found');
      }
      if (product.sellerId !== data.authorId) {
        throw new UnauthorizedException('You do not own this product');
      }
    }

    // Verify serviceId belongs to the caller
    if (data.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: data.serviceId },
        select: { category: true, providerId: true },
      });
      if (!service) {
        throw new BadRequestException('Service not found');
      }
      if (service.providerId !== data.authorId) {
        throw new UnauthorizedException('You do not own this service');
      }
    }

    // Determine product category for vertical assignment
    let productCategory: string | undefined;
    if (data.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
        select: { category: true },
      });
      productCategory = product?.category;
    }

    // Determine service category for vertical assignment
    let serviceCategory: string | undefined;
    if (data.serviceId) {
      const service = await this.prisma.service.findUnique({
        where: { id: data.serviceId },
        select: { category: true },
      });
      serviceCategory = service?.category;
    }

    // Assign vertical based on type and product/service category
    const vertical = assignVertical(data.type, productCategory, serviceCategory);

    return this.prisma.post.create({
      data: {
        authorId: data.authorId,
        type: data.type,
        vertical,
        caption: data.caption,
        mediaUrl: data.mediaUrl,
        thumbnailUrl: data.thumbnailUrl,
        mediaType: data.mediaType || 'IMAGE',
        mediaAssetId: data.mediaAssetId,
        productId: data.productId,
        serviceId: data.serviceId,
      },
      include: {
        author: true,
        product: true,
        service: true,
      },
    });
  }

  public async createProduct(data: {
    name: string;
    description?: string;
    price: number;
    unit: string;
    category: string;
    location?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mediaType?: string;
    mediaAssetId?: string;
    sellerId: string;
  }) {
    if (data.mediaAssetId) {
      await this.assertAssetCanBeAttached(data.sellerId, data.mediaAssetId);
    }

    return this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        unit: data.unit,
        category: data.category,
        location: data.location,
        mediaUrl: data.mediaUrl,
        thumbnailUrl: data.thumbnailUrl,
        mediaType: data.mediaType || 'IMAGE',
        mediaAssetId: data.mediaAssetId,
        sellerId: data.sellerId,
      },
    });
  }

  public async createService(data: {
    name: string;
    description?: string;
    category: string;
    location?: string;
    price?: string;
    availability?: string;
    experience?: string;
    mediaUrl?: string;
    thumbnailUrl?: string;
    mediaType?: string;
    providerId: string;
  }) {
    return this.prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        category: data.category,
        location: data.location,
        price: data.price,
        availability: data.availability,
        experience: data.experience,
        mediaUrl: data.mediaUrl,
        thumbnailUrl: data.thumbnailUrl,
        mediaType: data.mediaType || 'IMAGE',
        providerId: data.providerId,
      },
    });
  }

  public async getPostContact(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            emailVerified: true,
            phoneVerified: true,
          },
        },
        mediaAsset: true,
        product: { include: { mediaAsset: true } },
        offering: { include: { demoAsset: true } },
      },
    });

    if (!post) {
      throw new BadRequestException('Post not found');
    }

    // Check if post is visible to the user (media READY or author's own)
    const mediaAsset = post.mediaAsset ?? post.product?.mediaAsset ?? post.offering?.demoAsset;
    const isAuthor = post.authorId === userId;
    const mediaReady = !mediaAsset || mediaAsset.status === MediaAssetStatus.READY;

    if (!isAuthor && !mediaReady) {
      throw new BadRequestException('Post is not visible');
    }

    // Check if author is verified
    if (!post.author.emailVerified || !post.author.phoneVerified) {
      throw new BadRequestException('Author is not verified');
    }

    return {
      id: post.author.id,
      fullName: post.author.fullName,
      phoneNumber: post.author.phoneNumber,
    };
  }

  public async getPlayback(postId: string): Promise<PlaybackResponse> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        mediaAsset: true,
        product: { include: { mediaAsset: true } },
        offering: { include: { demoAsset: true } },
      },
    });

    if (!post) {
      throw new BadRequestException('Post not found');
    }

    const mediaAsset = post.mediaAsset ?? post.product?.mediaAsset ?? post.offering?.demoAsset;
    if (!mediaAsset) {
      throw new BadRequestException('Post has no media asset');
    }

    if (mediaAsset.status !== MediaAssetStatus.READY) {
      throw new BadRequestException('Media asset is not ready');
    }

    if (mediaAsset.kind !== MediaAssetKind.VIDEO || !mediaAsset.hlsManifestKey) {
      throw new BadRequestException('HLS manifest not available');
    }

    const { url, expiresAt } = await this.mediaUrlSigner.createPlaybackUrl(mediaAsset.hlsManifestKey);

    return {
      postId,
      hlsUrl: url,
      durationSec: mediaAsset.durationSec || 0,
      expiresAt,
    };
  }

  private async assertAssetCanBeAttached(userId: string, assetId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id: assetId } });
    if (!asset) throw new BadRequestException('Media asset not found');
    if (asset.ownerId !== userId) throw new UnauthorizedException('You do not own this media asset');
    if (asset.status !== 'READY' && asset.status !== 'PROCESSING') {
      throw new BadRequestException('Media asset must be processing or ready');
    }
  }

  public async recordView(postId: string, userId: string): Promise<string> {
    // Verify post exists and is visible to the user
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: true,
        mediaAsset: true,
        product: { include: { mediaAsset: true } },
        offering: { include: { demoAsset: true } },
      },
    });

    if (!post) {
      throw new BadRequestException('Post not found');
    }

    // Check if post is visible to the user
    const mediaAsset = post.mediaAsset ?? post.product?.mediaAsset ?? post.offering?.demoAsset;
    const isAuthor = post.authorId === userId;
    const mediaReady = !mediaAsset || mediaAsset.status === MediaAssetStatus.READY;

    if (!isAuthor && !mediaReady) {
      // Post is not visible to this user, don't record view
      this.logger.log(`Post ${postId} not visible to user ${userId}, skipping view recording`);
      return postId;
    }

    // Don't count author's own views
    if (isAuthor) {
      this.logger.log(`User ${userId} is author of post ${postId}, skipping view recording`);
      return postId;
    }

    // Use transaction to create PostView and increment viewsCount atomically
    try {
      await this.prisma.$transaction(async (tx) => {
        // Try to create a PostView record (unique constraint prevents duplicates)
        await tx.postView.create({
          data: {
            postId,
            userId,
          },
        });

        // Increment viewsCount only if this is a new view
        await tx.post.update({
          where: { id: postId },
          data: {
            viewsCount: {
              increment: 1,
            },
          },
        });
      });

      this.logger.log(`Recorded view for post ${postId} by user ${userId}`);
    } catch (error: any) {
      // Check for Prisma unique constraint error (P2002)
      if (error.code === 'P2002') {
        this.logger.log(`User ${userId} already viewed post ${postId}`);
      } else {
        throw error;
      }
    }

    return postId;
  }

  public async getPlaybacks(postIds: string[]): Promise<PlaybackResponse[]> {
    const posts = await this.prisma.post.findMany({
      where: {
        id: { in: postIds },
      },
      include: {
        mediaAsset: true,
        product: { include: { mediaAsset: true } },
        offering: { include: { demoAsset: true } },
      },
    });

    const responses: PlaybackResponse[] = [];

    for (const post of posts) {
      const mediaAsset = post.mediaAsset ?? post.product?.mediaAsset ?? post.offering?.demoAsset;
      if (!mediaAsset) {
        continue; // Skip posts without media
      }

      if (mediaAsset.status !== MediaAssetStatus.READY) {
        continue; // Skip posts that aren't ready
      }

      if (mediaAsset.kind !== MediaAssetKind.VIDEO || !mediaAsset.hlsManifestKey) {
        continue; // Skip non-video posts
      }

      const { url, expiresAt } = await this.mediaUrlSigner.createPlaybackUrl(mediaAsset.hlsManifestKey);

      responses.push({
        postId: post.id,
        hlsUrl: url,
        durationSec: mediaAsset.durationSec || 0,
        expiresAt,
      });
    }

    return responses;
  }
} 