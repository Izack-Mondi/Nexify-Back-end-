import { Injectable } from '@nestjs/common';
import { StorageService } from './storage.service.interface';
import { MediaUrlSigner } from './media-url-signer.interface';

@Injectable()
export class PublicMediaUrlSigner extends MediaUrlSigner {
  constructor(private readonly storage: StorageService) {
    super();
  }

  async createPlaybackUrl(key: string): Promise<{ url: string; expiresAt: Date }> {
    return {
      url: this.storage.publicUrl(key),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
  }
}
