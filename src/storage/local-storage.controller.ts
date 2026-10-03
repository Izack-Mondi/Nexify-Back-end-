import { Controller, Put, Get, Param, Query, Req, Res, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from './local-storage.service';

@Controller('storage')
export class LocalStorageController {
  constructor(
    private readonly localStorageService: LocalStorageService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Put('upload/*key')
  async uploadFile(
    @Param('key') keyParts: string[] | string,
    @Query('expires') expires: string,
    @Query('signature') signature: string,
    @Req() request: Request,
  ) {
    this.ensureLocalDriver();
    const key = this.normalizeKey(keyParts);
    const expiresAt = Number(expires);
    if (!this.localStorageService.verifyUploadUrl(key, request.headers['content-type'] || '', expiresAt, signature || '')) {
      throw new BadRequestException('Upload URL is invalid or expired');
    }
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { storageKey: key, status: 'UPLOADING' },
      select: { mimeType: true, sizeBytes: true },
    });
    if (!asset) throw new NotFoundException();
    if (request.headers['content-type'] !== asset.mimeType) {
      throw new BadRequestException('Content type does not match upload request');
    }
    const contentLength = Number(request.headers['content-length']);
    try {
      await this.localStorageService.saveUploadedFile(
        key,
        request,
        asset.sizeBytes,
        Number.isFinite(contentLength) ? contentLength : undefined,
      );
    } catch (error) {
      if (error instanceof Error && /size limit|expected size/.test(error.message)) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return {
      success: true,
      key,
    };
  }

  @Get('public/*key')
  async getPublicFile(@Param('key') keyParts: string[] | string, @Res() response: Response) {
    this.ensureLocalDriver();
    const key = this.normalizeKey(keyParts);
    let filePath: string;
    try {
      filePath = this.localStorageService.getPublicFilePath(key);
    } catch {
      throw new NotFoundException();
    }
    try {
      const contentType: Record<string, string> = {
        '.m3u8': 'application/vnd.apple.mpegurl',
        '.ts': 'video/mp2t',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
      };
      response.type(contentType[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      await pipeline(createReadStream(filePath), response);
    } catch {
      if (!response.headersSent) {
        throw new NotFoundException();
      }
    }
  }

  private ensureLocalDriver(): void {
    if ((this.configService.get<string>('STORAGE_DRIVER') || 'local') !== 'local') {
      throw new NotFoundException();
    }
  }

  private normalizeKey(keyParts: string[] | string): string {
    const parts = Array.isArray(keyParts) ? keyParts : [keyParts];
    return parts.join('/').split('/').map(decodeURIComponent).join('/');
  }
}
