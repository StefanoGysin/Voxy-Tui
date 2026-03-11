import { describe, expect, test } from 'bun:test';
import { stripAnsi } from './strip-ansi';

describe('stripAnsi', () => {
  test('remove SGR sequences (colors, styles)', () => {
    expect(stripAnsi('\x1b[31mhello\x1b[0m')).toBe('hello');
  });
  test('remove multiple sequences', () => {
    expect(stripAnsi('\x1b[1m\x1b[33mBold Yellow\x1b[0m')).toBe('Bold Yellow');
  });
  test('plain string returns unchanged', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
  });
  test('remove cursor save/restore DEC', () => {
    expect(stripAnsi('\x1b7text\x1b8')).toBe('text');
  });
  test('empty string returns empty', () => {
    expect(stripAnsi('')).toBe('');
  });
});
