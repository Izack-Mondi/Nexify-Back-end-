export abstract class MediaUrlSigner {
  abstract createPlaybackUrl(key: string): Promise<{ url: string; expiresAt: Date }>;
}
