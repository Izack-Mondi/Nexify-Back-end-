import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { FeedInput, FeedConnection, PostEdge, PageInfo, PostType, FeedTab, PostMedia, PostServiceOffering, PlaybackResponse } from './feed.types';
import { assignVertical, Vertical } from '../common/vertical-assignment';
import { MediaAssetStatus, MediaAssetKind } from '../media/media.types';
import { MediaUrlSigner } from '../storage/media-url-signer.interface';

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

  private encodeCursor(id: string, createdAt: Date): string {
    const cursorData = {
      v: 1,
      c: createdAt.getTime(),
      i: id,
    };
    return Buffer.from(JSON.stringify(cursorData)).toString('base64url');
  }

  private decodeCursor(cursor: string): { id: string; createdAt: number } | null {
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

  async getFeed(input: FeedInput): Promise<FeedConnection> {
    const first = input.first ?? 10;
    const after = input.after;
    const type = input.type;
    const tab = input.tab ?? FeedTab.ALL;

    this.logger.log(`Fetching feed with first=${first}, after=${after}, type=${type}, tab=${tab}`);

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

    // Fetch posts with pagination
    const posts = await this.prisma.post.findMany({
      where: {
        ...where,
        ...cursorFilter,
        AND: [
          {
            OR: [
              { mediaAssetId: null },
              { mediaAsset: { is: { status: MediaAssetStatus.READY } } },
            ],
          },
          {
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
          },
          {
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
          },
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
    const edges = hasNextPage ? posts.slice(0, first) : posts;

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
      if (post.offering && (!post.offering.demoAsset || post.offering.demoAsset.status === MediaAssetStatus.READY)) {
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
    const pageInfo: PageInfo = {
      hasNextPage,
      endCursor: postEdges.length > 0 ? postEdges[postEdges.length - 1].cursor : undefined,
    };

    return {
      edges: postEdges,
      pageInfo,
    };
  }

  async createPost(data: {
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
    // Determine product category for vertical assignment
    let productCategory: string | undefined;
    if (data.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: data.productId },
        select: { category: true },
      });
      productCategory = product?.category;
    }

    // Assign vertical based on type and product category
    const vertical = assignVertical(data.type, productCategory);

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

  async createProduct(data: {
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

  async createService(data: {
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

  async getPostContact(postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!post) {
      throw new Error('Post not found');
    }

    return {
      id: post.author.id,
      fullName: post.author.fullName,
      phoneNumber: post.author.phoneNumber,
    };
  }

  async getPlayback(postId: string): Promise<PlaybackResponse> {
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
} 