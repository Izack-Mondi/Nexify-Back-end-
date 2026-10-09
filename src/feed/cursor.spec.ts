import { FeedService } from './feed.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service.interface';
import { MediaUrlSigner } from '../storage/media-url-signer.interface';

describe('FeedService cursor encoding/decoding', () => {
  let feedService: FeedService;

  beforeEach(() => {
    const prisma = {} as PrismaService;
    const storage = {} as StorageService;
    const signer = {} as MediaUrlSigner;
    feedService = new FeedService(prisma, storage, signer);
  });

  it('should encode and decode cursor correctly', () => {
    const id = 'test-id-123';
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    
    const encoded = feedService.encodeCursor(id, createdAt);
    const decoded = feedService.decodeCursor(encoded);
    
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(id);
    expect(decoded?.createdAt).toBe(createdAt.getTime());
  });

  it('should handle same timestamp with different IDs', () => {
    const timestamp = new Date('2024-01-01T00:00:00.000Z');
    const id1 = 'id-1';
    const id2 = 'id-2';
    
    const encoded1 = feedService.encodeCursor(id1, timestamp);
    const encoded2 = feedService.encodeCursor(id2, timestamp);
    
    const decoded1 = feedService.decodeCursor(encoded1);
    const decoded2 = feedService.decodeCursor(encoded2);
    
    expect(decoded1?.id).toBe(id1);
    expect(decoded2?.id).toBe(id2);
    expect(decoded1?.createdAt).toBe(decoded2?.createdAt);
  });

  it('should return null for invalid cursor', () => {
    expect(feedService.decodeCursor('invalid-cursor')).toBeNull();
    expect(feedService.decodeCursor('')).toBeNull();
  });

  it('should return null for wrong version', () => {
    const cursorData = {
      v: 2,
      c: Date.now(),
      i: 'test-id',
    };
    const encoded = Buffer.from(JSON.stringify(cursorData)).toString('base64url');
    
    expect(feedService.decodeCursor(encoded)).toBeNull();
  });

  it('should return null for malformed JSON', () => {
    const encoded = Buffer.from('not-valid-json').toString('base64url');
    expect(feedService.decodeCursor(encoded)).toBeNull();
  });

  it('should produce opaque base64url strings', () => {
    const id = 'test-id-123';
    const createdAt = new Date();
    
    const encoded = feedService.encodeCursor(id, createdAt);
    
    // Should be base64url (no +, /, = characters in the output)
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });
});
