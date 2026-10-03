export abstract class StorageService {
  /**
   * Creates a presigned upload URL for direct client uploads
   */
  abstract createUploadUrl(key: string, contentType: string, expiresIn: number): Promise<string>;

  /**
   * Checks if an object exists and returns its metadata
   */
  abstract headObject(key: string): Promise<{ sizeBytes: number; contentType: string } | null>;

  /**
   * Downloads an object to a local file path
   */
  abstract getObjectToFile(key: string, localPath: string): Promise<void>;

  /**
   * Uploads a file from a local path
   */
  abstract putObject(key: string, localPath: string, contentType: string): Promise<void>;

  /**
   * Gets a public URL for an object
   */
  abstract publicUrl(key: string): string;

  /**
   * Deletes an object
   */
  abstract deleteObject(key: string): Promise<void>;
}
