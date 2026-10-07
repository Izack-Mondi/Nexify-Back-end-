const MAX_CONSECUTIVE_VERTICAL_POSTS = 2;

export function interleaveFeedEdges<T extends { node: { vertical: string } }>(
  edges: readonly T[],
): T[] {
  const remaining = new Map<string, T[]>();
  for (const edge of edges) {
    const vertical = edge.node.vertical;
    const bucket = remaining.get(vertical) ?? [];
    bucket.push(edge);
    remaining.set(vertical, bucket);
  }

  const interleaved: T[] = [];
  let previousVertical: string | undefined;
  let consecutiveCount = 0;

  while (interleaved.length < edges.length) {
    const available = [...remaining.entries()].filter(([, bucket]) => bucket.length > 0);
    if (available.length === 0) break;

    available.sort((left, right) => right[1].length - left[1].length);
    const shouldBreakStreak = consecutiveCount >= MAX_CONSECUTIVE_VERTICAL_POSTS;
    const differentVertical = shouldBreakStreak
      ? available.find(([vertical]) => vertical !== previousVertical)
      : undefined;
    const [vertical, bucket] = differentVertical ?? available[0];

    interleaved.push(bucket.shift()!);
    if (vertical === previousVertical) {
      consecutiveCount += 1;
    } else {
      previousVertical = vertical;
      consecutiveCount = 1;
    }
  }

  return interleaved;
}
