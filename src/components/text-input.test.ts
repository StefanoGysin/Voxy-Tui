import { describe, expect, test } from 'bun:test';
import { TextInput } from './text-input';
import type { KeyEvent } from '../core/component';

function key(k: string, opts: Partial<KeyEvent> = {}): KeyEvent {
  return { key: k, ctrl: false, meta: false, shift: false, raw: k, ...opts };
}

describe('TextInput', () => {
  test('getValue() retorna string vazia inicial', () => {
    expect(new TextInput().getValue()).toBe('');
  });

  test('inserir caracteres atualiza valor', () => {
    const t = new TextInput();
    t.handleKey(key('h', { raw: 'h' }));
    t.handleKey(key('i', { raw: 'i' }));
    expect(t.getValue()).toBe('hi');
  });

  test('backspace apaga último caractere', () => {
    const t = new TextInput();
    t.handleKey(key('a', { raw: 'a' }));
    t.handleKey(key('b', { raw: 'b' }));
    t.handleKey(key('backspace'));
    expect(t.getValue()).toBe('a');
  });

  test('Enter dispara onSubmit', () => {
    let submitted = '';
    const t = new TextInput();
    t.onSubmit = (v) => { submitted = v; };
    t.handleKey(key('h', { raw: 'h' }));
    t.handleKey(key('return'));
    expect(submitted).toBe('h');
  });

  test('Shift+Enter insere newline (não submete)', () => {
    let submitted = false;
    const t = new TextInput();
    t.onSubmit = () => { submitted = true; };
    t.handleKey(key('h', { raw: 'h' }));
    t.handleKey(key('return', { shift: true }));
    expect(submitted).toBe(false);
    expect(t.getValue()).toBe('h\n');
  });

  test('Ctrl+Z desfaz última edição', () => {
    const t = new TextInput();
    t.handleKey(key('a', { raw: 'a' }));
    t.handleKey(key('b', { raw: 'b' }));
    t.handleKey(key('z', { ctrl: true }));
    expect(t.getValue()).toBe('a');
  });

  test('Ctrl+K mata até fim da linha, Ctrl+Y recupera', () => {
    const t = new TextInput();
    ['a', 'b', 'c'].forEach(c => t.handleKey(key(c, { raw: c })));
    // Cursor está no fim. Voltar 2 posições com Left+Left
    t.handleKey(key('left'));
    t.handleKey(key('left'));
    t.handleKey(key('k', { ctrl: true })); // mata 'bc'
    expect(t.getValue()).toBe('a');
    t.handleKey(key('y', { ctrl: true })); // recupera 'bc'
    expect(t.getValue()).toBe('abc');
  });

  test('clear() reseta tudo', () => {
    const t = new TextInput();
    t.handleKey(key('a', { raw: 'a' }));
    t.clear();
    expect(t.getValue()).toBe('');
  });

  test('render inclui prompt na primeira linha', () => {
    const t = new TextInput({ prompt: '> ' });
    t.onFocus();
    const lines = t.render(80, 10);
    expect(lines[0]).toContain('> ');
  });

  test('setValue define conteúdo multilinha', () => {
    const t = new TextInput();
    t.setValue('linha1\nlinha2\nlinha3');
    expect(t.getValue()).toBe('linha1\nlinha2\nlinha3');
    expect(t.render(80, 10).length).toBe(3);
  });
});
