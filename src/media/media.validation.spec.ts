import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { MediaService } from './media.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { ConfigService } from '@nestjs/config';
import { MediaAssetStatus, MediaAssetKind } from './media.types';

describe('MediaService - Upload Validation', () => {
  let mediaService: MediaService;
  let prismaService: any;
  let storageService: any;

  beforeEach(() => {
    prismaService = {
      mediaAsset: {
        create: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };
    storageService = {
      createUploadUrl: jest.fn(),
      headObject: jest.fn(),
    };
    const configService = {
      get: jest.fn((key: string) => ({
        MAX_VIDEO_BYTES: 300 * 1024 * 1024,
        MAX_VIDEO_DURATION_SEC: 600,
        MAX_IMAGE_BYTES: 10 * 1024 * 1024,
        UPLOAD_URL_EXPIRES_IN: 3600,
        MAX_CONCURRENT_UPLOADS: 5,
      }[key])),
    };
    mediaService = new MediaService(
      prismaService as PrismaService,
      storageService as StorageService,
      configService as unknown as ConfigService,
      { add: jest.fn() } as any,
    );
  });

  describe('requestVideoUpload', () => {
    it('should reject invalid content types', async () => {
      await expect(
        mediaService.requestVideoUpload('user-1', {
          contentType: 'image/jpeg',
          sizeBytes: 1000000,
        })
      ).rejects.toThrow('Invalid content type');
    });

    it('should reject oversized videos', async () => {
      await expect(
        mediaService.requestVideoUpload('user-1', {
          contentType: 'video/mp4',
          sizeBytes: 400 * 1024 * 1024, // 400 MB
        })
      ).rejects.toThrow('File size exceeds maximum');
    });

    it('should reject when concurrent upload limit exceeded', async () => {
      (prismaService.mediaAsset.count as jest.Mock).mockResolvedValue(5);

      await expect(
        mediaService.requestVideoUpload('user-1', {
          contentType: 'video/mp4',
          sizeBytes: 1000000,
        })
      ).rejects.toThrow('Maximum concurrent uploads');
    });

    it('should accept valid video upload request', async () => {
      (prismaService.mediaAsset.count as jest.Mock).mockResolvedValue(0);
      (prismaService.mediaAsset.create as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        status: MediaAssetStatus.UPLOADING,
      });
      (storageService.createUploadUrl as jest.Mock).mockResolvedValue('https://example.com/upload');

      const result = await mediaService.requestVideoUpload('user-1', {
        contentType: 'video/mp4',
        sizeBytes: 1000000,
      });

      expect(result.assetId).toBeDefined();
      expect(result.uploadUrl).toBe('https://example.com/upload');
      expect(result.maxSizeBytes).toBe(300 * 1024 * 1024);
      expect(result.maxDurationSec).toBe(600);
    });
  });

  describe('completeUpload - Ownership', () => {
    it('should reject completeUpload for non-owner', async () => {
      (prismaService.mediaAsset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        ownerId: 'user-2',
        status: MediaAssetStatus.UPLOADING,
        storageKey: 'uploads/asset-1',
      });

      await expect(
        mediaService.completeUpload('user-1', 'asset-1')
      ).rejects.toThrow('You do not own this asset');
    });

    it('should reject completeUpload when file not found in storage', async () => {
      (prismaService.mediaAsset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        ownerId: 'user-1',
        status: MediaAssetStatus.UPLOADING,
        storageKey: 'uploads/asset-1',
      });
      (storageService.headObject as jest.Mock).mockResolvedValue(null);

      await expect(
        mediaService.completeUpload('user-1', 'asset-1')
      ).rejects.toThrow('File not found in storage');
    });

    it('should reject completeUpload when size mismatch', async () => {
      (prismaService.mediaAsset.findUnique as jest.Mock).mockResolvedValue({
        id: 'asset-1',
        ownerId: 'user-1',
        status: MediaAssetStatus.UPLOADING,
        storageKey: 'uploads/asset-1',
        sizeBytes: 1000000,
      });
      (storageService.headObject as jest.Mock).mockResolvedValue({
        sizeBytes: 2000000, // 2x expected size
        contentType: 'video/mp4',
      });

      await expect(
        mediaService.completeUpload('user-1', 'asset-1')
      ).rejects.toThrow('File size does not match expected size');
    });
  });
});
