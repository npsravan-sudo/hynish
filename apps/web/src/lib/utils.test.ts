import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });
  it('applies conditional classes', () => {
    const show = false;
    expect(cn('a', show && 'b', 'c')).toBe('a c');
  });
  it('de-conflicts tailwind utilities (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-sm text-muted-foreground', 'text-foreground')).toBe('text-sm text-foreground');
  });
});
