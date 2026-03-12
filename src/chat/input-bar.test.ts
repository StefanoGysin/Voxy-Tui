import { describe, test, expect, beforeEach, afterEach, it } from 'bun:test';
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

describe('InputBar — histórico', () => {
  let bar: InputBar;

  afterEach(() => { bar = undefined as unknown as InputBar; });

  function submit(b: InputBar, text: string): void {
    // Simular submit: setar valor e pressionar Enter
    b['input'].setValue(text);
    b['input']['onSubmit']?.(text);
  }

  it('↑ sem histórico não faz nada', () => {
    bar = new InputBar();
    const handled = bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(handled).toBe(false);
  });

  it('↑ após 1 submit mostra último item', () => {
    bar = new InputBar();
    submit(bar, 'olá');
    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(bar.getValue()).toBe('olá');
  });

  it('↑ ↑ navega dois itens', () => {
    bar = new InputBar();
    submit(bar, 'primeiro');
    submit(bar, 'segundo');
    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(bar.getValue()).toBe('segundo');
    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(bar.getValue()).toBe('primeiro');
  });

  it('↑ no início do histórico não sai do limite', () => {
    bar = new InputBar();
    submit(bar, 'único');
    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(bar.getValue()).toBe('único');
  });

  it('↓ após ↑ restaura rascunho', () => {
    bar = new InputBar();
    submit(bar, 'histórico');
    // Usuário digita rascunho
    bar['input'].setValue('rascunho parcial');
    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    bar.handleKey({ key: 'down', ctrl: false, meta: false, shift: false, raw: '' });
    expect(bar.getValue()).toBe('rascunho parcial');
  });

  it('não adiciona duplicatas consecutivas', () => {
    bar = new InputBar();
    submit(bar, 'repetido');
    submit(bar, 'repetido');
    expect(bar.getHistory()).toHaveLength(1);
  });

  it('não adiciona entrada vazia ao histórico', () => {
    bar = new InputBar();
    submit(bar, '   ');
    expect(bar.getHistory()).toHaveLength(0);
  });

  it('getHistory() retorna cópia imutável', () => {
    bar = new InputBar();
    submit(bar, 'item');
    const h = bar.getHistory();
    h.push('invasão');
    expect(bar.getHistory()).toHaveLength(1);
  });

  it('setHistory() carrega histórico e permite navegação', () => {
    bar = new InputBar();
    bar.setHistory(['anterior1', 'anterior2']);
    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(bar.getValue()).toBe('anterior2');
  });

  it('clearHistory() limpa tudo', () => {
    bar = new InputBar();
    submit(bar, 'msg');
    bar.clearHistory();
    const handled = bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(handled).toBe(false);
  });
});
