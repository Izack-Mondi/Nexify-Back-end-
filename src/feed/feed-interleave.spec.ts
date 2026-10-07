import { interleaveFeedEdges } from './feed-interleave';

describe('interleaveFeedEdges', () => {
  it('avoids more than two consecutive posts of one vertical when possible', () => {
    const edges = [
      edge('b1', 'BUSINESS'),
      edge('b2', 'BUSINESS'),
      edge('b3', 'BUSINESS'),
      edge('b4', 'BUSINESS'),
      edge('a1', 'AGRICULTURE'),
      edge('a2', 'AGRICULTURE'),
      edge('o1', 'OPPORTUNITY'),
    ];

    const result = interleaveFeedEdges(edges);

    expect(result.map(({ node }) => node.id)).toEqual([
      'b1',
      'b2',
      'a1',
      'b3',
      'b4',
      'a2',
      'o1',
    ]);
    expect(maxConsecutiveVerticals(result)).toBeLessThanOrEqual(2);
    expect(result.map(({ node }) => node.id).sort())
      .toEqual(edges.map(({ node }) => node.id).sort());
  });

  it('preserves all posts and only permits a longer streak when no alternative remains', () => {
    const edges = [
      edge('b1', 'BUSINESS'),
      edge('b2', 'BUSINESS'),
      edge('b3', 'BUSINESS'),
      edge('b4', 'BUSINESS'),
    ];

    const result = interleaveFeedEdges(edges);

    expect(result).toEqual(edges);
    expect(maxConsecutiveVerticals(result)).toBe(4);
  });
});

function edge(id: string, vertical: string) {
  return {
    node: { id, vertical },
    cursor: `cursor-${id}`,
  };
}

function maxConsecutiveVerticals(
  edges: ReturnType<typeof edge>[],
): number {
  let maximum = 0;
  let consecutive = 0;
  let previous: string | undefined;

  for (const { node } of edges) {
    if (node.vertical === previous) {
      consecutive += 1;
    } else {
      previous = node.vertical;
      consecutive = 1;
    }
    maximum = Math.max(maximum, consecutive);
  }

  return maximum;
}
