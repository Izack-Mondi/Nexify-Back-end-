import { mkdtemp, rm } from 'fs/promises';
import { Readable } from 'stream';
import * as os from 'os';
import * as path from 'path';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService', () => {
  let root: string;
  let storage: LocalStorageService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'nexify-local-storage-'));
    const config = {
      get: (key: string) => ({
        LOCAL_STORAGE_DIR: root,
        LOCAL_STORAGE_PUBLIC_URL: 'http://localhost:3000/storage',
        LOCAL_UPLOAD_SECRET: 'test-local-secret',
        MAX_VIDEO_BYTES: 100,
      } as Record<string, string | number>)[key],
    };
    storage = new LocalStorageService(config as any);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('signs local PUT URLs for the exact content type until their expiry', async () => {
    const uploadUrl = await storage.createUploadUrl('uploads/user/asset/source', 'video/mp4', 60);
    const url = new URL(uploadUrl);
    const signature = url.searchParams.get('signature') || '';
    const expires = Number(url.searchParams.get('expires'));

    expect(storage.verifyUploadUrl('uploads/user/asset/source', 'video/mp4', expires, signature)).toBe(true);
    expect(storage.verifyUploadUrl('uploads/user/asset/source', 'video/webm', expires, signature)).toBe(false);
    expect(storage.verifyUploadUrl('uploads/user/asset/source', 'video/mp4', 1, signature)).toBe(false);
  });

  it('stores exact streamed byte counts and keeps original uploads private', async () => {
    await storage.saveUploadedFile('uploads/user/asset/source', Readable.from(Buffer.from('video')), 5, 5);
    await expect(storage.headObject('uploads/user/asset/source')).resolves.toMatchObject({ sizeBytes: 5 });
    expect(() => storage.getPublicFilePath('uploads/user/asset/source')).toThrow();
    expect(() => storage.getPublicFilePath('../outside')).toThrow();
  });

  it('rejects a streamed size mismatch and removes the incomplete object', async () => {
    await expect(storage.saveUploadedFile(
      'uploads/user/asset/incorrect',
      Readable.from(Buffer.from('small')),
      20,
      5,
    )).rejects.toThrow('expected size');
    await expect(storage.headObject('uploads/user/asset/incorrect')).resolves.toBeNull();
  });
});