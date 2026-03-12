import { describe, expect, test } from 'bun:test';
import type { Component } from '../core/component';
import { Border } from './border';
import { Text } from './text';
import { FG_GREEN, RESET } from '../core/ansi';
import { stripAnsi } from '../utils/strip-ansi';
import { measureWidth } from '../utils/width';

describe('Border', () => {
  test('adds top and bottom lines', () => {
    const b = new Border(new Text('conteudo'));
    const lines = b.render(20, 5);
    expect(lines[0]).toContain('\u256D'); // rounded default
    expect(lines[lines.length - 1]).toContain('\u2570');
  });
  test('side borders on all middle lines', () => {
    const b = new Border(new Text('hi'));
    const lines = b.render(20, 5);
    expect(lines[1]).toContain('\u2502');
  });
  test('style double uses double characters', () => {
    const b = new Border(new Text('x'), 'double');
    const lines = b.render(20, 5);
    expect(lines[0]).toContain('\u2554');
  });
  test('title appears in top line', () => {
    const b = new Border(new Text('x'), 'single', 'Title');
    const lines = b.render(30, 5);
    expect(lines[0]).toContain('Title');
  });
});

class ColoredLine implements Component {
  constructor(private text: string) {}
  render(_w: number, _h: number): string[] {
    return [`${FG_GREEN}${this.text}${RESET}`];
  }
}

describe('Border com texto colorido (ANSI)', () => {
  test('linha com ANSI tem largura visual correta', () => {
    const b = new Border(new ColoredLine('hello'));
    const lines = b.render(20, 3);
    const middle = lines[1];
    const visual = measureWidth(stripAnsi(middle));
    expect(visual).toBe(20);
  });

  test('padding correto — bordas alinhadas com ANSI', () => {
    const b = new Border(new ColoredLine('hi'));
    const lines = b.render(10, 3);
    const visual = measureWidth(stripAnsi(lines[1]));
    expect(visual).toBe(10);
  });
});
