import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MediaAssetKind, MediaAssetStatus } from '../media/media.types';
import { CreateServiceOfferingInput, ServiceOffering } from './service-offerings.types';
import { KENYA_COUNTIES } from '../common/kenya-counties';
import { Vertical } from '../common/vertical-assignment';

@Injectable()
export class ServiceOfferingsService {
  private readonly logger = new Logger(ServiceOfferingsService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createServiceOffering(
    userId: string,
    input: CreateServiceOfferingInput,
  ): Promise<{ offeringId: string; postId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('An active account is required to create service offerings');
    }

    if (input.vertical !== Vertical.BUSINESS && input.vertical !== Vertical.AGRICULTURE) {
      throw new BadRequestException('Service offering vertical must be BUSINESS or AGRICULTURE');
    }

    if (!KENYA_COUNTIES.some((county) => county === input.county)) {
      throw new BadRequestException(`Invalid county. Must be one of: ${KENYA_COUNTIES.join(', ')}`);
    }

    // Validate demo asset ownership if provided
    if (input.demoAssetId) {
      const asset = await this.prisma.mediaAsset.findUnique({
        where: { id: input.demoAssetId },
      });

      if (!asset) {
        throw new BadRequestException('Demo asset not found');
      }

      if (asset.ownerId !== userId) {
        throw new UnauthorizedException('You do not own this asset');
      }

      if (asset.kind !== MediaAssetKind.VIDEO) {
        throw new BadRequestException('Demo asset must be a video');
      }
      if (asset.status !== 'READY' && asset.status !== 'PROCESSING') {
        throw new BadRequestException('Demo asset must be processing or ready');
      }
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const offering = await transaction.serviceOffering.create({
        data: {
          providerId: userId,
          title: input.title,
          category: input.category,
          description: input.description,
          skills: input.skills,
          yearsExperience: input.yearsExperience,
          startingPrice: input.startingPrice,
          priceUnit: input.priceUnit,
          county: input.county,
          demoAssetId: input.demoAssetId,
        },
      });

      const post = await transaction.post.create({
        data: {
          authorId: userId,
          type: 'GENERAL',
          vertical: input.vertical,
          caption: input.description || input.title,
          mediaAssetId: input.demoAssetId,
          offeringId: offering.id,
        },
      });

      return { offering, post };
    });

    this.logger.log(`Created service offering ${result.offering.id} with post ${result.post.id}`);

    return {
      offeringId: result.offering.id,
      postId: result.post.id,
    };
  }

  async getServiceOffering(offeringId: string): Promise<ServiceOffering> {
    const offering = await this.prisma.serviceOffering.findUnique({
      where: { id: offeringId },
      include: {
        demoAsset: true,
      },
    });

    if (!offering) {
      throw new BadRequestException('Service offering not found');
    }

    // Only show if demo asset is READY or null
    if (offering.demoAsset && offering.demoAsset.status !== MediaAssetStatus.READY) {
      throw new BadRequestException('Service offering is not ready yet');
    }

    return offering;
  }
}
