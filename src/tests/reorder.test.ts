import { describe, expect, it } from 'vitest';
import { moveArrayItem } from '../lib/reorder';

describe('moveArrayItem', () => {
  it('moves an item up without mutating the original list', () => {
    const original = ['first', 'second', 'third'];

    expect(moveArrayItem(original, 1, 'up')).toEqual(['second', 'first', 'third']);
    expect(original).toEqual(['first', 'second', 'third']);
  });

  it('moves an item down', () => {
    expect(moveArrayItem(['first', 'second', 'third'], 1, 'down')).toEqual([
      'first',
      'third',
      'second',
    ]);
  });

  it('keeps the order at list boundaries', () => {
    expect(moveArrayItem(['first', 'second'], 0, 'up')).toEqual(['first', 'second']);
    expect(moveArrayItem(['first', 'second'], 1, 'down')).toEqual(['first', 'second']);
  });
});
