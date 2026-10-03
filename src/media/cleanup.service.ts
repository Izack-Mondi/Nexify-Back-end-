import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { MediaAssetStatus } from './media.types';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupStuckUploads() {
    this.logger.log('Starting cleanup of stuck uploads...');

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stuckAssets = await this.prisma.mediaAsset.findMany({
      where: {
        status: MediaAssetStatus.UPLOADING,
        createdAt: {
          lt: twentyFourHoursAgo,
        },
      },
    });

    this.logger.log(`Found ${stuckAssets.length} stuck uploads`);

    for (const asset of stuckAssets) {
      try {
        // Delete from storage
        await this.storage.deleteObject(asset.storageKey);

        // Delete HLS outputs if they exist
        if (asset.hlsManifestKey) {
          await this.storage.deleteObject(asset.hlsManifestKey);
        }
        if (asset.posterKey) {
          await this.storage.deleteObject(asset.posterKey);
        }
        if (asset.previewKey) {
          await this.storage.deleteObject(asset.previewKey);
        }

        // Delete from database
        await this.prisma.mediaAsset.delete({
          where: { id: asset.id },
        });

        this.logger.log(`Cleaned up stuck asset ${asset.id}`);
      } catch (error) {
        this.logger.error(`Failed to cleanup asset ${asset.id}: ${error}`);
      }
    }

    this.logger.log('Cleanup completed');
  }
}
