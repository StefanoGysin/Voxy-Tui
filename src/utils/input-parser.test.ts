import { describe, expect, test } from 'bun:test';
import { parseKey, parseMouseScroll } from './input-parser';

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

describe('parseMouseScroll', () => {
  test('scroll up SGR → scroll-up', () => {
    expect(parseMouseScroll('\x1b[<64;1;1M')).toBe('scroll-up');
  });

  test('scroll down SGR → scroll-down', () => {
    expect(parseMouseScroll('\x1b[<65;10;20M')).toBe('scroll-down');
  });

  test('evento release (m) → null (botão ignorado)', () => {
    expect(parseMouseScroll('\x1b[<64;1;1m')).toBeNull();
  });

  test('clique esquerdo (btn=0) → null', () => {
    expect(parseMouseScroll('\x1b[<0;1;1M')).toBeNull();
  });

  test('sequência de teclado normal → null', () => {
    expect(parseMouseScroll('\x1b[A')).toBeNull();
  });

  test('string vazia → null', () => {
    expect(parseMouseScroll('')).toBeNull();
  });

  test('sequência incompleta → null', () => {
    expect(parseMouseScroll('\x1b[<')).toBeNull();
  });
});
