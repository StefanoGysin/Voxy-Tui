import { describe, test, expect, beforeEach } from 'bun:test';
import { InputBar } from './input-bar';
import { stripAnsi } from '../utils/strip-ansi';

describe('InputBar', () => {
  let bar: InputBar;
  beforeEach(() => {
    bar = new InputBar({ prompt: '> ', placeholder: 'Type here...' });
  });

  test('render inclui separador na primeira linha', () => {
    const lines = bar.render(20, 3);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const stripped = stripAnsi(lines[0]);
    expect(stripped).toMatch(/^─+$/);
  });

  test('separatorChar customizável', () => {
    const bar2 = new InputBar({ separatorChar: '=' });
    const lines = bar2.render(10, 3);
    const stripped = stripAnsi(lines[0]);
    expect(stripped).toMatch(/^=+$/);
  });

  test('separador tem width caracteres', () => {
    const lines = bar.render(30, 3);
    const stripped = stripAnsi(lines[0]);
    expect(stripped.length).toBe(30);
  });

  test('minHeight = TextInput.minHeight + 1', () => {
    expect(bar.minHeight()).toBe(2);
  });

  test('getValue retorna string vazia inicialmente', () => {
    expect(bar.getValue()).toBe('');
  });

  test('clear limpa o conteúdo', () => {
    bar.onFocus();
    bar.handleKey({ key: 'h', ctrl: false, meta: false, shift: false, raw: 'h' });
    bar.handleKey({ key: 'i', ctrl: false, meta: false, shift: false, raw: 'i' });
    expect(bar.getValue()).toBe('hi');
    bar.clear();
    expect(bar.getValue()).toBe('');
  });

  test('onSubmit callback é chamado ao pressionar Enter', () => {
    let submitted = '';
    bar.onSubmit = (text) => { submitted = text; };
    bar.onFocus();
    bar.handleKey({ key: 'h', ctrl: false, meta: false, shift: false, raw: 'h' });
    bar.handleKey({ key: 'return', ctrl: false, meta: false, shift: false, raw: '\r' });
    expect(submitted).toBe('h');
  });

  test('onChange callback é chamado ao digitar', () => {
    const changes: string[] = [];
    bar.onChange = (text) => { changes.push(text); };
    bar.onFocus();
    bar.handleKey({ key: 'x', ctrl: false, meta: false, shift: false, raw: 'x' });
    expect(changes).toContain('x');
  });

  test('handleKey delega ao TextInput', () => {
    bar.onFocus();
    bar.handleKey({ key: 'a', ctrl: false, meta: false, shift: false, raw: 'a' });
    expect(bar.getValue()).toBe('a');
  });
});
