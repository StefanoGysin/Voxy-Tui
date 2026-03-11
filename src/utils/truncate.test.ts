import { describe, expect, test } from 'bun:test';
import { truncate } from './truncate';

describe('truncate', () => {
  test('short string returns unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });
  test('exact width returns unchanged', () => {
    expect(truncate('hello', 5)).toBe('hello');
  });
  test('long string is truncated with ellipsis', () => {
    const result = truncate('hello world', 6);
    expect(result).toContain('\u2026');
    expect(result.length).toBeLessThanOrEqual(6);
  });
  test('maxWidth=1 returns just ellipsis', () => {
    expect(truncate('hello', 1)).toBe('\u2026');
  });
  test('maxWidth=0 returns ellipsis', () => {
    expect(truncate('hello', 0)).toBe('\u2026');
  });
});
