import { describe, expect, test } from 'bun:test';
import { BOLD, DIM, RESET, ITALIC, UNDERLINE, STRIKETHROUGH } from './ansi';

describe('ANSI modifiers', () => {
  test('BOLD is correct SGR sequence', () => {
    expect(BOLD).toBe('\x1b[1m');
  });

  test('DIM is correct SGR sequence', () => {
    expect(DIM).toBe('\x1b[2m');
  });

  test('RESET is correct SGR sequence', () => {
    expect(RESET).toBe('\x1b[0m');
  });

  test('ITALIC is correct SGR sequence', () => {
    expect(ITALIC).toBe('\x1b[3m');
  });

  test('UNDERLINE is correct SGR sequence', () => {
    expect(UNDERLINE).toBe('\x1b[4m');
  });

  test('STRIKETHROUGH is correct SGR sequence', () => {
    expect(STRIKETHROUGH).toBe('\x1b[9m');
  });
});
