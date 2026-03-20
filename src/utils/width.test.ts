import { describe, it, expect } from 'bun:test';
import { padEndAnsi, fitWidth } from './width';
import { measureWidth } from './width';
import { stripAnsi } from './strip-ansi';
import { FG_GREEN, RESET, BOLD, DIM } from '../core/ansi';

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

describe('fitWidth', () => {
  it('linha curta — pad com espaços', () => {
    expect(fitWidth('hello', 10)).toBe('hello     ');
  });

  it('linha exata — retorna sem modificar', () => {
    expect(fitWidth('hello', 5)).toBe('hello');
  });

  it('linha longa — trunca para largura exata', () => {
    const result = fitWidth('hello world', 5);
    expect(measureWidth(stripAnsi(result))).toBe(5);
    expect(result).toBe('hello');
  });

  it('linha com ANSI — pad baseado em largura visual', () => {
    const colored = `${FG_GREEN}hi${RESET}`;
    const result = fitWidth(colored, 5);
    expect(measureWidth(stripAnsi(result))).toBe(5);
    expect(result).toBe(colored + '   ');
  });

  it('linha com ANSI longa — trunca preservando ANSI de abertura', () => {
    const colored = `${FG_GREEN}hello world${RESET}`;
    const result = fitWidth(colored, 5);
    expect(measureWidth(stripAnsi(result))).toBe(5);
    expect(result).toContain(FG_GREEN);
  });

  it('ANSI adjacente ao truncamento — preserva sequências', () => {
    // RESET logo após o ponto de truncamento
    const line = `${FG_GREEN}hello${RESET} world`;
    const result = fitWidth(line, 5);
    expect(measureWidth(stripAnsi(result))).toBe(5);
    expect(result).toContain(FG_GREEN);
    expect(result).toContain(RESET);
  });

  it('largura 0 — retorna string vazia visual', () => {
    const result = fitWidth('hello', 0);
    expect(measureWidth(stripAnsi(result))).toBe(0);
  });

  it('linha com múltiplas sequências ANSI — largura exata', () => {
    const line = `${FG_GREEN}${BOLD}ab${RESET}${DIM}cd${RESET}efgh`;
    const result = fitWidth(line, 4);
    expect(measureWidth(stripAnsi(result))).toBe(4);
  });

  it('linha com wide chars (CJK) — trunca corretamente', () => {
    // '中' é 2 colunas visuais
    const result = fitWidth('中中中', 5);
    // 中中 = 4 colunas + 1 espaço padding = 5
    expect(measureWidth(stripAnsi(result))).toBe(5);
  });
});
