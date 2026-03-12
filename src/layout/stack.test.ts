import { describe, expect, test } from 'bun:test';
import type { Component } from '../core/component';
import { Stack } from './stack';
import { Text } from '../components/text';
import { FG_CYAN, RESET } from '../core/ansi';
import { stripAnsi } from '../utils/strip-ansi';
import { measureWidth } from '../utils/width';

describe('Stack vertical', () => {
  test('empilha linhas dos componentes', () => {
    const s = new Stack([new Text('linha A'), new Text('linha B')]);
    const lines = s.render(80, 24);
    expect(lines).toContain('linha A');
    expect(lines).toContain('linha B');
    expect(lines.indexOf('linha A')).toBeLessThan(lines.indexOf('linha B'));
  });

  test('componente vazio não adiciona linhas', () => {
    const s = new Stack([new Text('hello')]);
    expect(s.render(80, 24).length).toBe(1);
  });
});

describe('Stack horizontal', () => {
  test('renderiza componentes lado a lado', () => {
    const s = new Stack([new Text('AA'), new Text('BB')], 'horizontal');
    const lines = s.render(20, 5);
    expect(lines[0]).toContain('AA');
    expect(lines[0]).toContain('BB');
  });
});

class ColorLine implements Component {
  constructor(private text: string) {}
  render(_w: number, _h: number): string[] { return [`${FG_CYAN}${this.text}${RESET}`]; }
}

describe('Stack horizontal com ANSI', () => {
  test('colunas com texto colorido têm largura visual correta', () => {
    const s = new Stack([new ColorLine('AA'), new ColorLine('BB')], 'horizontal');
    const lines = s.render(20, 1);
    const visual = measureWidth(stripAnsi(lines[0]));
    expect(visual).toBe(20);
  });
});
