import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service.interface';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { createHmac, timingSafeEqual } from 'crypto';

const mkdir = fs.promises.mkdir;
const stat = fs.promises.stat;
const unlink = fs.promises.unlink;

@Injectable()
export class LocalStorageService extends StorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly storageDir: string;
  private readonly publicBaseUrl: string;
  private readonly maxUploadBytes: number;
  private readonly uploadSecret: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.storageDir = this.configService.get<string>('LOCAL_STORAGE_DIR') || './storage';
    this.publicBaseUrl = this.configService.get<string>('LOCAL_STORAGE_PUBLIC_URL') || 'http://localhost:3000/storage';
    this.maxUploadBytes = this.configService.get<number>('MAX_VIDEO_BYTES') || 300 * 1024 * 1024;
    this.uploadSecret = this.configService.get<string>('LOCAL_UPLOAD_SECRET') ||
      this.configService.get<string>('JWT_SECRET') || 'nexify-local-upload-secret';
    
    // Ensure storage directory exists
    mkdir(this.storageDir, { recursive: true }).catch((err) => {
      if (err.code !== 'EEXIST') {
        this.logger.error(`Failed to create storage directory: ${err}`);
      }
    });
  }

  async createUploadUrl(key: string, contentType: string, expiresIn: number): Promise<string> {
    // For local storage, return a direct PUT endpoint URL
    // The actual upload will be handled by a REST controller
    const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    const signature = this.signUpload(key, contentType, expiresAt);
    return `${this.publicBaseUrl}/upload/${this.encodeKey(key)}?expires=${expiresAt}&signature=${signature}`;
  }

  verifyUploadUrl(key: string, contentType: string, expiresAt: number, signature: string): boolean {
    if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.signUpload(key, contentType, expiresAt));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  async headObject(key: string): Promise<{ sizeBytes: number; contentType: string } | null> {
    try {
      const filePath = this.getFilePath(key);
      const stats = await stat(filePath);
      
      return {
        sizeBytes: stats.size,
        contentType: 'application/octet-stream',
      };
    } catch (error) {
      return null;
    }
  }

  async getObjectToFile(key: string, localPath: string): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    await pipeline(createReadStream(filePath), createWriteStream(localPath));
  }

  async putObject(key: string, localPath: string, contentType: string): Promise<void> {
    const filePath = this.getFilePath(key);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await pipeline(createReadStream(localPath), createWriteStream(filePath));
  }

  publicUrl(key: string): string {
    return `${this.publicBaseUrl}/public/${this.encodeKey(key)}`;
  }

  async deleteObject(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    try {
      await unlink(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.error(`Failed to delete object ${key}: ${error}`);
        throw error;
      }
    }
  }

  async saveUploadedFile(
    key: string,
    input: NodeJS.ReadableStream,
    expectedSizeBytes: number,
    contentLength?: number,
  ): Promise<void> {
    if (contentLength !== undefined && contentLength > this.maxUploadBytes) {
      throw new Error('Upload exceeds the local storage size limit');
    }
    if (contentLength !== undefined && contentLength !== expectedSizeBytes) {
      throw new Error('Content length does not match expected size');
    }
    const filePath = this.getFilePath(key);
    const dir = path.dirname(filePath);
    await mkdir(dir, { recursive: true });

    let receivedBytes = 0;
    const limit = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        receivedBytes += chunk.length;
        if (receivedBytes > this.maxUploadBytes) {
          callback(new Error('Upload exceeds the local storage size limit'));
          return;
        }
        callback(null, chunk);
      },
    });
    try {
      await pipeline(input, limit, createWriteStream(filePath, { flags: 'wx' }));
      if (receivedBytes !== expectedSizeBytes) {
        throw new Error('Uploaded byte count does not match expected size');
      }
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  getPublicFilePath(key: string): string {
    if (!key.startsWith('media/')) {
      throw new Error('Only processed media objects are public');
    }
    return this.getFilePath(key);
  }

  private getFilePath(key: string): string {
    const root = path.resolve(this.storageDir);
    const filePath = path.resolve(root, key);
    if (!filePath.startsWith(`${root}${path.sep}`)) {
      throw new Error('Invalid storage key');
    }
    return filePath;
  }

  private encodeKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/');
  }

  private signUpload(key: string, contentType: string, expiresAt: number): string {
    return createHmac('sha256', this.uploadSecret)
      .update(`${key}\n${contentType}\n${expiresAt}`)
      .digest('hex');
  }
}
