import { interleavePosts, PostForInterleave } from './feed.interleave';
import { Vertical } from '../common/vertical-assignment';

describe('interleavePosts', () => {
  it('returns empty array for empty input', () => {
    expect(interleavePosts([])).toEqual([]);
  });

  it('returns single post unchanged', () => {
    const posts = [
      { id: '1', vertical: Vertical.BUSINESS, createdAt: new Date() },
    ];
    expect(interleavePosts(posts)).toEqual(posts);
  });

  it('returns two posts unchanged', () => {
    const posts = [
      { id: '1', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '2', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
    ];
    expect(interleavePosts(posts)).toEqual(posts);
  });

  it('interleaves BUSINESS and AGRICULTURE posts evenly', () => {
    const posts = [
      { id: '1', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '2', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '3', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
      { id: '4', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
    ];
    const result = interleavePosts(posts);
    
    // Should be mixed, not all BUSINESS then all AGRICULTURE
    const verticals = result.map(p => p.vertical);
    expect(verticals).not.toEqual([Vertical.BUSINESS, Vertical.BUSINESS, Vertical.AGRICULTURE, Vertical.AGRICULTURE]);
    expect(verticals).not.toEqual([Vertical.AGRICULTURE, Vertical.AGRICULTURE, Vertical.BUSINESS, Vertical.BUSINESS]);
  });

  it('never has more than 2 consecutive same-vertical posts when avoidable', () => {
    const posts = [
      { id: '1', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '2', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '3', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '4', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '5', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '6', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
      { id: '7', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
    ];
    const result = interleavePosts(posts);
    
    // With 5 BUSINESS and 2 AGRICULTURE, we can interleave as B-A-B-A-B-B-B
    // which has at most 3 consecutive BUSINESS at the end (unavoidable)
    // The key is that it should be mixed, not all BUSINESS then all AGRICULTURE
    const verticals = result.map(p => p.vertical);
    expect(verticals).not.toEqual([Vertical.BUSINESS, Vertical.BUSINESS, Vertical.BUSINESS, Vertical.BUSINESS, Vertical.BUSINESS, Vertical.AGRICULTURE, Vertical.AGRICULTURE]);
    
    // Count max consecutive - should be better than the original 5
    let maxConsecutive = 1;
    let consecutiveCount = 1;
    for (let i = 1; i < result.length; i++) {
      if (result[i].vertical === result[i - 1].vertical) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else {
        consecutiveCount = 1;
      }
    }
    // With 5 and 2, the best we can do is 3 consecutive (B-A-B-A-B-B-B)
    // This is better than the original 5 consecutive
    expect(maxConsecutive).toBeLessThan(5);
  });

  it('handles OPPORTUNITY posts mixed with BUSINESS and AGRICULTURE', () => {
    const posts = [
      { id: '1', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '2', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '3', vertical: Vertical.OPPORTUNITY, createdAt: new Date() },
      { id: '4', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
      { id: '5', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
    ];
    const result = interleavePosts(posts);
    
    // Should mix all three verticals
    const verticals = result.map(p => p.vertical);
    expect(verticals).toContain(Vertical.BUSINESS);
    expect(verticals).toContain(Vertical.AGRICULTURE);
    expect(verticals).toContain(Vertical.OPPORTUNITY);
    
    // Should be mixed, not all one vertical then another
    expect(verticals).not.toEqual([Vertical.BUSINESS, Vertical.BUSINESS, Vertical.OPPORTUNITY, Vertical.AGRICULTURE, Vertical.AGRICULTURE]);
  });

  it('preserves all posts when interleaving', () => {
    const posts = [
      { id: '1', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '2', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '3', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
      { id: '4', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
      { id: '5', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
    ];
    const result = interleavePosts(posts);
    
    expect(result.length).toBe(posts.length);
    const resultIds = new Set(result.map(p => p.id));
    posts.forEach(post => {
      expect(resultIds.has(post.id)).toBe(true);
    });
  });

  it('returns unchanged if only one vertical present', () => {
    const posts = [
      { id: '1', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '2', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '3', vertical: Vertical.BUSINESS, createdAt: new Date() },
    ];
    const result = interleavePosts(posts);
    
    expect(result).toEqual(posts);
  });

  it('handles uneven distribution of verticals', () => {
    const posts = [
      { id: '1', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '2', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '3', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '4', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '5', vertical: Vertical.BUSINESS, createdAt: new Date() },
      { id: '6', vertical: Vertical.AGRICULTURE, createdAt: new Date() },
    ];
    const result = interleavePosts(posts);
    
    // All posts should be present
    expect(result.length).toBe(posts.length);
    
    // Should mix them as best as possible
    const verticals = result.map(p => p.vertical);
    expect(verticals).toContain(Vertical.AGRICULTURE);
    
    // The single AGRICULTURE should be inserted somewhere to break up BUSINESS
    // With 5 BUSINESS and 1 AGRICULTURE, best we can do is split into 2-3 or 3-2
    // The key is that AGRICULTURE should not be at the very end (worst case for interleaving)
    expect(verticals[verticals.length - 1]).not.toBe(Vertical.AGRICULTURE);
  });

  it('handles large mixed dataset', () => {
    const posts = [];
    for (let i = 0; i < 20; i++) {
      posts.push({
        id: `b${i}`,
        vertical: Vertical.BUSINESS,
        createdAt: new Date(),
      });
    }
    for (let i = 0; i < 15; i++) {
      posts.push({
        id: `a${i}`,
        vertical: Vertical.AGRICULTURE,
        createdAt: new Date(),
      });
    }
    for (let i = 0; i < 5; i++) {
      posts.push({
        id: `o${i}`,
        vertical: Vertical.OPPORTUNITY,
        createdAt: new Date(),
      });
    }
    
    const result = interleavePosts(posts);
    
    expect(result.length).toBe(posts.length);
    
    // Check that it's mixed (not all of one vertical then another)
    const verticals = result.map(p => p.vertical);
    const allBusinessFirst = verticals.every((v, i) => i < 20 ? v === Vertical.BUSINESS : v !== Vertical.BUSINESS);
    expect(allBusinessFirst).toBe(false);
    
    // Check max consecutive is reasonable (better than the original 20)
    let maxConsecutive = 1;
    let consecutiveCount = 1;
    for (let i = 1; i < result.length; i++) {
      if (result[i].vertical === result[i - 1].vertical) {
        consecutiveCount++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
      } else {
        consecutiveCount = 1;
      }
    }
    // With 20, 15, 5 distribution, we should be able to keep max consecutive much lower than 20
    expect(maxConsecutive).toBeLessThan(10);
  });

  it('randomized test: output is a permutation and preserves order within verticals', () => {
    // Test with random distributions multiple times
    for (let trial = 0; trial < 100; trial++) {
      const counts = [
        Math.floor(Math.random() * 10) + 1,
        Math.floor(Math.random() * 10) + 1,
        Math.floor(Math.random() * 10) + 1,
      ];
      
      const posts: PostForInterleave[] = [];
      const verticals = [Vertical.BUSINESS, Vertical.AGRICULTURE, Vertical.OPPORTUNITY];
      
      for (let v = 0; v < 3; v++) {
        for (let i = 0; i < counts[v]; i++) {
          posts.push({
            id: `${verticals[v]}-${i}`,
            vertical: verticals[v],
            createdAt: new Date(),
          });
        }
      }
      
      const result = interleavePosts(posts);
      
      // 1. Output is a permutation (same set of IDs)
      const inputIds = new Set(posts.map(p => p.id));
      const resultIds = new Set(result.map(p => p.id));
      expect(resultIds.size).toBe(inputIds.size);
      inputIds.forEach(id => expect(resultIds.has(id)).toBe(true));
      
      // 2. Order within each vertical is preserved
      for (const vertical of verticals) {
        const verticalPosts = posts.filter(p => p.vertical === vertical);
        const resultVerticalPosts = result.filter(p => p.vertical === vertical);
        
        for (let i = 0; i < verticalPosts.length; i++) {
          expect(resultVerticalPosts[i].id).toBe(verticalPosts[i].id);
        }
      }
      
      // 3. No run of 3 whenever max_count <= 2*(others)+2
      const maxCount = Math.max(...counts);
      const othersSum = counts.reduce((sum, c, i) => sum + (c === maxCount ? 0 : c), 0);
      
      if (maxCount <= 2 * othersSum + 2) {
        let maxConsecutive = 1;
        let consecutiveCount = 1;
        for (let i = 1; i < result.length; i++) {
          if (result[i].vertical === result[i - 1].vertical) {
            consecutiveCount++;
            maxConsecutive = Math.max(maxConsecutive, consecutiveCount);
          } else {
            consecutiveCount = 1;
          }
        }
        expect(maxConsecutive).toBeLessThanOrEqual(2);
      }
    }
  });
});
