import { describe, it, expect } from 'bun:test';
import { padEndAnsi } from './width';
import { FG_GREEN, RESET } from '../core/ansi';

describe('padEndAnsi', () => {
  it('texto puro — comportamento igual a padEnd', () => {
    expect(padEndAnsi('hello', 10)).toBe('hello     ');
  });

  it('texto já na largura alvo — sem padding', () => {
    expect(padEndAnsi('hello', 5)).toBe('hello');
  });

  it('texto mais largo que alvo — retorna sem modificar', () => {
    const result = padEndAnsi('hello world', 5);
    expect(result).toBe('hello world');
  });

  it('texto com ANSI — padding baseado em largura visual', () => {
    const colored = `${FG_GREEN}hi${RESET}`;
    // "hi" tem 2 colunas visuais, target=5 → 3 espaços de padding
    const result = padEndAnsi(colored, 5);
    expect(result).toBe(colored + '   ');
  });

  it('texto com ANSI longo — não adiciona padding', () => {
    const colored = `${FG_GREEN}hello${RESET}`;
    // "hello" tem 5 colunas visuais, target=5 → sem padding
    expect(padEndAnsi(colored, 5)).toBe(colored);
  });

  it('target 0 — retorna string original', () => {
    expect(padEndAnsi('hi', 0)).toBe('hi');
  });
});
