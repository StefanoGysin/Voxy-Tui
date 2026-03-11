import { describe, expect, test } from 'bun:test';
import { wrapText } from './wrap';

describe('wrapText', () => {
  test('short line does not wrap', () => {
    expect(wrapText('hello', 80)).toEqual(['hello']);
  });
  test('line exactly at limit does not wrap', () => {
    expect(wrapText('hello', 5)).toEqual(['hello']);
  });
  test('wraps at word boundary', () => {
    const result = wrapText('hello world foo', 8);
    expect(result).toContain('hello');
    expect(result.length).toBeGreaterThan(1);
  });
  test('preserves explicit newlines', () => {
    const result = wrapText('linha1\nlinha2', 80);
    expect(result).toEqual(['linha1', 'linha2']);
  });
  test('width=0 returns original line', () => {
    expect(wrapText('hello', 0)).toEqual(['hello']);
  });
});
