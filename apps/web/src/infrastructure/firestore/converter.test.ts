import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { timestampsToMillis } from './converter';

describe('timestampsToMillis (§52 Timestamp -> epoch ms)', () => {
  it('converts a top-level Timestamp', () => {
    const ms = 1_700_000_000_000;
    expect(timestampsToMillis(Timestamp.fromMillis(ms))).toBe(ms);
  });
  it('converts nested Timestamps in objects and arrays', () => {
    const ms = 1_700_000_000_000;
    const input = {
      createdAt: Timestamp.fromMillis(ms),
      nested: { updatedAt: Timestamp.fromMillis(ms + 1000) },
      list: [{ at: Timestamp.fromMillis(ms + 2000) }],
      plain: 'x',
      n: 5,
      nullish: null,
    };
    const out = timestampsToMillis(input) as {
      createdAt: number;
      nested: { updatedAt: number };
      list: Array<{ at: number }>;
      plain: string;
      n: number;
      nullish: null;
    };
    expect(out.createdAt).toBe(ms);
    expect(out.nested.updatedAt).toBe(ms + 1000);
    expect(out.list[0]!.at).toBe(ms + 2000);
    expect(out.plain).toBe('x');
    expect(out.n).toBe(5);
    expect(out.nullish).toBeNull();
  });
});
