import { Vertical } from '../common/vertical-assignment';

export interface PostForInterleave {
  id: string;
  vertical: Vertical;
  createdAt: Date;
}

/**
 * Interleaves posts within a page to avoid more than 2 consecutive cards sharing a vertical when avoidable.
 * This is a pure function that reorders posts without changing the underlying pagination logic.
 * 
 * Algorithm: At each step, pick the vertical with the most posts remaining that doesn't already have 2 in a row.
 * Preserves order within each vertical.
 * 
 * @param posts - Posts to interleave, should already be sorted by createdAt DESC, id DESC
 * @returns Reordered posts with verticals mixed as evenly as possible
 */
export function interleavePosts(posts: PostForInterleave[]): PostForInterleave[] {
  if (posts.length <= 2) {
    return posts;
  }

  // Group posts by vertical, preserving order
  const byVertical = new Map<Vertical, PostForInterleave[]>();
  for (const post of posts) {
    if (!byVertical.has(post.vertical)) {
      byVertical.set(post.vertical, []);
    }
    byVertical.get(post.vertical)!.push(post);
  }

  // Get verticals
  const verticals = Array.from(byVertical.keys());

  // If only one vertical exists, no interleaving needed
  if (verticals.length <= 1) {
    return posts;
  }

  // Build interleaved sequence
  const result: PostForInterleave[] = [];
  const indices = new Map<Vertical, number>();
  verticals.forEach(v => indices.set(v, 0));
  const total = verticals.reduce((sum, v) => sum + byVertical.get(v)!.length, 0);

  // Track consecutive same-vertical posts
  let consecutiveCount = 0;
  let lastVertical: Vertical | null = null;

  while (result.length < total) {
    // Find the vertical with the most posts remaining that doesn't have 2 in a row
    let bestVertical: Vertical | null = null;
    let maxRemaining = -1;

    for (const vertical of verticals) {
      const available = byVertical.get(vertical)!;
      const used = indices.get(vertical)!;
      const remaining = available.length - used;

      if (remaining <= 0) {
        continue; // No more posts of this vertical
      }

      // Skip if this would create 3+ consecutive same-vertical posts
      if (lastVertical === vertical && consecutiveCount >= 2) {
        continue;
      }

      // Pick the vertical with the most remaining posts
      if (remaining > maxRemaining) {
        maxRemaining = remaining;
        bestVertical = vertical;
      }
    }

    // If no vertical meets the criteria (only happens when impossible to avoid 3+),
    // fall back to the vertical with the most remaining regardless of consecutive count
    if (bestVertical === null) {
      for (const vertical of verticals) {
        const available = byVertical.get(vertical)!;
        const used = indices.get(vertical)!;
        const remaining = available.length - used;

        if (remaining > maxRemaining) {
          maxRemaining = remaining;
          bestVertical = vertical;
        }
      }
    }

    if (bestVertical === null) {
      break; // No more posts available
    }

    // Take the next post from the chosen vertical
    const verticalPosts = byVertical.get(bestVertical)!;
    const postIndex = indices.get(bestVertical)!;
    const post = verticalPosts[postIndex];
    result.push(post);
    indices.set(bestVertical, postIndex + 1);

    // Update consecutive counter
    if (lastVertical === bestVertical) {
      consecutiveCount++;
    } else {
      consecutiveCount = 1;
      lastVertical = bestVertical;
    }
  }

  return result;
}
