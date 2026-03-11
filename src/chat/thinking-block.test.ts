import { describe, test, expect, beforeEach } from 'bun:test';
import { ThinkingBlock } from './thinking-block';
import { stripAnsi } from '../utils/strip-ansi';

describe('ThinkingBlock', () => {
  let block: ThinkingBlock;
  beforeEach(() => { block = new ThinkingBlock(); });

  test('colapsado por default — 1 linha', () => {
    block.setContent('pensamento interno');
    expect(block.render(80, 10)).toHaveLength(1);
  });

  test('colapsado mostra ▶ e contagem de linhas', () => {
    block.setContent('linha 1\nlinha 2\nlinha 3');
    const line = stripAnsi(block.render(80, 10)[0]);
    expect(line).toContain('▶');
    expect(line).toContain('3 linhas');
    expect(line).toContain('Chain of thought');
  });

  test('expandido mostra ▼ e conteúdo', () => {
    block.setContent('linha 1\nlinha 2');
    block.toggle();
    const lines = block.render(80, 10).map(stripAnsi);
    expect(lines[0]).toContain('▼');
    expect(lines.join('\n')).toContain('linha 1');
    expect(lines.join('\n')).toContain('linha 2');
  });

  test('expandido: número de linhas = 1 + linhas do conteúdo', () => {
    block.setContent('a\nb\nc');
    block.toggle();
    expect(block.render(80, 10)).toHaveLength(4);
  });

  test('toggle colapsa de volta', () => {
    block.setContent('texto');
    block.toggle();
    block.toggle();
    expect(block.render(80, 10)).toHaveLength(1);
  });

  test('handleKey Enter faz toggle', () => {
    block.setContent('texto');
    block.handleKey({ key: 'return', ctrl: false, meta: false, shift: false, raw: '\r' });
    expect(block.isCollapsed()).toBe(false);
  });

  test('handleKey Space faz toggle', () => {
    block.setContent('texto');
    block.handleKey({ key: ' ', ctrl: false, meta: false, shift: false, raw: ' ' });
    expect(block.isCollapsed()).toBe(false);
  });

  test('minHeight colapsado = 1', () => {
    block.setContent('a\nb\nc');
    expect(block.minHeight()).toBe(1);
  });

  test('minHeight expandido = 1 + linhas', () => {
    block.setContent('a\nb\nc');
    block.toggle();
    expect(block.minHeight()).toBe(4);
  });
});
