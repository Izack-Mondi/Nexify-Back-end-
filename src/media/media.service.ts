import { Injectable, BadRequestException, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { MediaAsset as PrismaMediaAsset } from '@prisma/client';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';
import sharp from 'sharp';
import {
  RequestVideoUploadInput,
  RequestImageUploadInput,
  UploadUrlResponse,
  MediaAssetKind,
  MediaAssetStatus,
} from './media.types';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly maxVideoBytes: number;
  private readonly maxVideoDurationSec: number;
  private readonly maxImageBytes: number;
  private readonly uploadUrlExpiresIn: number;
  private readonly maxConcurrentUploads: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue('video-processing') private readonly videoProcessingQueue: Queue,
  ) {
    this.maxVideoBytes = this.getConfigNumber('MAX_VIDEO_BYTES', 300 * 1024 * 1024);
    this.maxVideoDurationSec = this.getConfigNumber('MAX_VIDEO_DURATION_SEC', 600);
    this.maxImageBytes = this.getConfigNumber('MAX_IMAGE_BYTES', 10 * 1024 * 1024);
    this.uploadUrlExpiresIn = this.getConfigNumber('UPLOAD_URL_EXPIRES_IN', 3600);
    this.maxConcurrentUploads = this.getConfigNumber('MAX_CONCURRENT_UPLOADS', 5);
  }

  async requestVideoUpload(userId: string, input: RequestVideoUploadInput): Promise<UploadUrlResponse> {
    // Validate content type
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!allowedVideoTypes.includes(input.contentType)) {
      throw new BadRequestException('Invalid content type. Allowed: video/mp4, video/quicktime, video/webm');
    }

    // Validate size
    if (input.sizeBytes < 1 || input.sizeBytes > this.maxVideoBytes) {
      throw new BadRequestException(`File size exceeds maximum of ${this.maxVideoBytes} bytes`);
    }

    // Check concurrent uploads limit
    const uploadingCount = await this.prisma.mediaAsset.count({
      where: {
        ownerId: userId,
        status: {
          in: [MediaAssetStatus.UPLOADING, MediaAssetStatus.PROCESSING],
        },
      },
    });

    if (uploadingCount >= this.maxConcurrentUploads) {
      throw new BadRequestException(
        `Maximum concurrent uploads (${this.maxConcurrentUploads}) exceeded. Please wait for current uploads to complete.`
      );
    }

    // Create asset record
    const assetId = uuidv4();
    const storageKey = `uploads/${userId}/${assetId}/${uuidv4()}`;
    const expiresAt = new Date(Date.now() + this.uploadUrlExpiresIn * 1000);

    await this.prisma.mediaAsset.create({
      data: {
        id: assetId,
        ownerId: userId,
        kind: MediaAssetKind.VIDEO,
        status: MediaAssetStatus.UPLOADING,
        mimeType: input.contentType,
        sizeBytes: input.sizeBytes,
        storageKey,
      },
    });

    // Generate upload URL
    const uploadUrl = await this.storage.createUploadUrl(
      storageKey,
      input.contentType,
      this.uploadUrlExpiresIn,
    );

    return {
      assetId,
      uploadUrl,
      expiresAt,
      maxSizeBytes: this.maxVideoBytes,
      maxDurationSec: this.maxVideoDurationSec,
    };
  }

  async requestImageUpload(userId: string, input: RequestImageUploadInput): Promise<UploadUrlResponse> {
    // Validate content type
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedImageTypes.includes(input.contentType)) {
      throw new BadRequestException('Invalid content type. Allowed: image/jpeg, image/png, image/webp');
    }

    // Validate size
    if (input.sizeBytes < 1 || input.sizeBytes > this.maxImageBytes) {
      throw new BadRequestException(`File size exceeds maximum of ${this.maxImageBytes} bytes`);
    }

    // Check concurrent uploads limit
    const uploadingCount = await this.prisma.mediaAsset.count({
      where: {
        ownerId: userId,
        status: {
          in: [MediaAssetStatus.UPLOADING, MediaAssetStatus.PROCESSING],
        },
      },
    });

    if (uploadingCount >= this.maxConcurrentUploads) {
      throw new BadRequestException(
        `Maximum concurrent uploads (${this.maxConcurrentUploads}) exceeded. Please wait for current uploads to complete.`
      );
    }

    // Create asset record
    const assetId = uuidv4();
    const storageKey = `uploads/${userId}/${assetId}/${uuidv4()}`;
    const expiresAt = new Date(Date.now() + this.uploadUrlExpiresIn * 1000);

    await this.prisma.mediaAsset.create({
      data: {
        id: assetId,
        ownerId: userId,
        kind: MediaAssetKind.IMAGE,
        status: MediaAssetStatus.UPLOADING,
        mimeType: input.contentType,
        sizeBytes: input.sizeBytes,
        storageKey,
      },
    });

    // Generate upload URL
    const uploadUrl = await this.storage.createUploadUrl(
      storageKey,
      input.contentType,
      this.uploadUrlExpiresIn,
    );

    return {
      assetId,
      uploadUrl,
      expiresAt,
      maxSizeBytes: this.maxImageBytes,
      maxDurationSec: 0, // Not applicable for images
    };
  }

  async completeUpload(userId: string, assetId: string): Promise<PrismaMediaAsset> {
    // Verify ownership
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new BadRequestException('Asset not found');
    }

    if (asset.ownerId !== userId) {
      throw new UnauthorizedException('You do not own this asset');
    }

    if (asset.status !== MediaAssetStatus.UPLOADING) {
      throw new BadRequestException('Asset is not in UPLOADING state');
    }

    // Verify object exists in storage
    const metadata = await this.storage.headObject(asset.storageKey);
    if (!metadata) {
      throw new BadRequestException('File not found in storage');
    }

    const maxBytes = asset.kind === MediaAssetKind.VIDEO ? this.maxVideoBytes : this.maxImageBytes;
    if (metadata.sizeBytes !== asset.sizeBytes || metadata.sizeBytes > maxBytes) {
      throw new BadRequestException('File size does not match expected size');
    }

    // Update status to PROCESSING
    const updatedAsset = await this.prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        status: MediaAssetStatus.PROCESSING,
        sizeBytes: metadata.sizeBytes,
      },
    });

    // Enqueue processing job for videos; promote validated image uploads immediately.
    if (asset.kind === MediaAssetKind.VIDEO) {
      try {
        await this.videoProcessingQueue.add('process-video', { assetId }, {
          jobId: assetId,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        });
      } catch (error) {
        await this.prisma.mediaAsset.update({
          where: { id: assetId },
          data: { status: MediaAssetStatus.UPLOADING },
        });
        throw error;
      }
    } else {
      return this.processImageUpload(asset);
    }

    return updatedAsset;
  }

  async getMediaAsset(userId: string, assetId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id: assetId },
    });

    if (!asset) {
      throw new BadRequestException('Asset not found');
    }

    // Only allow owner to see non-READY assets
    if (asset.status !== MediaAssetStatus.READY && asset.ownerId !== userId) {
      throw new UnauthorizedException('You do not have permission to view this asset');
    }

    return asset;
  }

  private async processImageUpload(asset: PrismaMediaAsset): Promise<PrismaMediaAsset> {
    const workDir = await mkdtemp(path.join(tmpdir(), 'nexify-image-'));
    const imagePath = path.join(workDir, 'image');
    const extension = ({
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    } as Record<string, string>)[asset.mimeType];
    const imageKey = `media/${asset.id}/image.${extension}`;

    try {
      await this.storage.getObjectToFile(asset.storageKey, imagePath);
      const metadata = await sharp(imagePath).metadata();
      const imageData = await sharp(imagePath)
        .resize(32, 32, { fit: 'inside' })
        .raw()
        .toBuffer({ resolveWithObject: true });
      const { encode } = await import('blurhash');
      const blurhash = encode(
        new Uint8ClampedArray(imageData.data),
        imageData.info.width,
        imageData.info.height,
        4,
        4,
      );
      await this.storage.putObject(imageKey, imagePath, asset.mimeType);
      const readyAsset = await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: {
          status: MediaAssetStatus.READY,
          posterKey: imageKey,
          width: metadata.width,
          height: metadata.height,
          blurhash,
        },
      });
      await this.storage.deleteObject(asset.storageKey);
      return readyAsset;
    } catch (error) {
      await this.prisma.mediaAsset.update({
        where: { id: asset.id },
        data: { status: MediaAssetStatus.REJECTED, rejectionReason: 'CORRUPT_FILE' },
      });
      await this.storage.deleteObject(asset.storageKey);
      throw new BadRequestException('Image could not be processed');
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private getConfigNumber(key: string, defaultValue: number): number {
    const value = Number(this.config.get(key));
    return Number.isFinite(value) && value > 0 ? value : defaultValue;
  }
}
