import { describe, expect, test } from 'bun:test';
import { Stack } from './stack';
import { Text } from '../components/text';

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
