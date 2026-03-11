import { describe, expect, test } from 'bun:test';
import { Border } from './border';
import { Text } from './text';

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
