import { describe, expect, test } from 'bun:test';
import { parseKey } from './input-parser';

describe('parseKey', () => {
  test('converte tecla simples', () => {
    const ev = parseKey({ sequence: 'a', name: 'a' });
    expect(ev.key).toBe('a');
    expect(ev.ctrl).toBe(false);
    expect(ev.meta).toBe(false);
    expect(ev.raw).toBe('a');
  });
  test('converte Ctrl+C', () => {
    const ev = parseKey({ sequence: '\x03', name: 'c', ctrl: true });
    expect(ev.key).toBe('c');
    expect(ev.ctrl).toBe(true);
  });
  test('normaliza backspace \\x7f', () => {
    const ev = parseKey({ sequence: '\x7f' });
    expect(ev.key).toBe('backspace');
  });
  test('normaliza enter \\r', () => {
    const ev = parseKey({ sequence: '\r' });
    expect(ev.key).toBe('return');
  });
  test('arrow keys mantêm nome normalizado', () => {
    const ev = parseKey({ sequence: '\x1b[A', name: 'up' });
    expect(ev.key).toBe('up');
  });
});
