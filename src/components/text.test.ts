import { describe, expect, test } from 'bun:test';
import { Text } from './text';

describe('Text', () => {
  test('render returns array with the line', () => {
    const t = new Text('hello');
    expect(t.render(80, 24)).toEqual(['hello']);
  });
  test('update changes content', () => {
    const t = new Text('before');
    t.update('after');
    expect(t.render(80, 24)[0]).toContain('after');
  });
  test('color applies prefix and RESET', () => {
    const t = new Text('hi', { color: '\x1b[31m' });
    const line = t.render(80, 24)[0];
    expect(line).toContain('\x1b[31m');
    expect(line).toContain('\x1b[0m');
  });
  test('wrap=true splits long lines', () => {
    const t = new Text('palavra1 palavra2 palavra3', { wrap: true });
    const lines = t.render(10, 24);
    expect(lines.length).toBeGreaterThan(1);
  });
  test('wrap=false keeps single line even if long', () => {
    const t = new Text('muito longo aqui', { wrap: false });
    expect(t.render(5, 24).length).toBe(1);
  });
});
