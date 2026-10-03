describe('Cursor encoding/decoding', () => {
  const encodeCursor = (id: string, createdAt: Date): string => {
    const cursorData = {
      v: 1,
      c: createdAt.getTime(),
      i: id,
    };
    return Buffer.from(JSON.stringify(cursorData)).toString('base64url');
  };

  const decodeCursor = (cursor: string): { id: string; createdAt: number } | null => {
    try {
      const decoded = Buffer.from(cursor, 'base64url').toString('utf-8');
      const cursorData = JSON.parse(decoded);
      
      if (cursorData.v !== 1) {
        return null;
      }
      
      return { id: cursorData.i, createdAt: cursorData.c };
    } catch (error) {
      return null;
    }
  };

  it('should encode and decode cursor correctly', () => {
    const id = 'test-id-123';
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    
    const encoded = encodeCursor(id, createdAt);
    const decoded = decodeCursor(encoded);
    
    expect(decoded).not.toBeNull();
    expect(decoded?.id).toBe(id);
    expect(decoded?.createdAt).toBe(createdAt.getTime());
  });

  it('should handle same timestamp with different IDs', () => {
    const timestamp = new Date('2024-01-01T00:00:00.000Z');
    const id1 = 'id-1';
    const id2 = 'id-2';
    
    const encoded1 = encodeCursor(id1, timestamp);
    const encoded2 = encodeCursor(id2, timestamp);
    
    const decoded1 = decodeCursor(encoded1);
    const decoded2 = decodeCursor(encoded2);
    
    expect(decoded1?.id).toBe(id1);
    expect(decoded2?.id).toBe(id2);
    expect(decoded1?.createdAt).toBe(decoded2?.createdAt);
  });

  it('should return null for invalid cursor', () => {
    expect(decodeCursor('invalid-cursor')).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('should return null for wrong version', () => {
    const cursorData = {
      v: 2,
      c: Date.now(),
      i: 'test-id',
    };
    const encoded = Buffer.from(JSON.stringify(cursorData)).toString('base64url');
    
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('should return null for malformed JSON', () => {
    const encoded = Buffer.from('not-valid-json').toString('base64url');
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('should produce opaque base64url strings', () => {
    const id = 'test-id-123';
    const createdAt = new Date();
    
    const encoded = encodeCursor(id, createdAt);
    
    // Should be base64url (no +, /, = characters in the output)
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
  });
});
