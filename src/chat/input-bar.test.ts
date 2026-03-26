import { describe, test, expect, beforeEach, afterEach, it, jest } from 'bun:test';
import { InputBar } from './input-bar';
import type { DropdownOption } from '../components/dropdown';
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

  test('setValue define o valor do input', () => {
    const bar = new InputBar();
    bar.setValue('hello world');
    expect(bar.getValue()).toBe('hello world');
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

describe('InputBar — histórico onChange', () => {
  test('navegação ↑ não dispara onChange', () => {
    const bar = new InputBar();
    bar.onFocus();
    bar.handleKey({ key: 'h', ctrl: false, meta: false, shift: false, raw: 'h' });
    bar.handleKey({ key: 'enter', ctrl: false, meta: false, shift: false, raw: '\r' });

    let changeCount = 0;
    bar.onChange = () => { changeCount++; };

    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '\x1b[A' });
    expect(changeCount).toBe(0);
  });

  test('navegação ↓ não dispara onChange', () => {
    const bar = new InputBar();
    bar.onFocus();
    bar.handleKey({ key: 'h', ctrl: false, meta: false, shift: false, raw: 'h' });
    bar.handleKey({ key: 'enter', ctrl: false, meta: false, shift: false, raw: '\r' });

    let changeCount = 0;
    bar.onChange = () => { changeCount++; };

    bar.handleKey({ key: 'up', ctrl: false, meta: false, shift: false, raw: '\x1b[A' });
    bar.handleKey({ key: 'down', ctrl: false, meta: false, shift: false, raw: '\x1b[B' });
    expect(changeCount).toBe(0);
  });

  test('digitação normal ainda dispara onChange', () => {
    const bar = new InputBar();
    bar.onFocus();
    let changeCount = 0;
    bar.onChange = () => { changeCount++; };
    bar.handleKey({ key: 'a', ctrl: false, meta: false, shift: false, raw: 'a' });
    expect(changeCount).toBeGreaterThan(0);
  });
});

describe('InputBar — completions', () => {
  const COMPLETIONS: DropdownOption[] = [
    { label: '/help', value: 'help', description: 'Ajuda' },
    { label: '/clear', value: 'clear', description: 'Limpar' },
    { label: '/model', value: 'model', description: 'Trocar modelo' },
  ];

  function key(k: string): { key: string; ctrl: boolean; meta: boolean; shift: boolean; raw: string } {
    return { key: k, ctrl: false, meta: false, shift: false, raw: '' };
  }

  let bar: InputBar;
  beforeEach(() => {
    bar = new InputBar();
  });

  // setCompletions
  it('setCompletions([...]) mostra o dropdown', () => {
    bar.setCompletions(COMPLETIONS);
    expect(bar.isCompletionVisible()).toBe(true);
  });

  it('setCompletions([]) oculta o dropdown', () => {
    bar.setCompletions(COMPLETIONS);
    bar.setCompletions([]);
    expect(bar.isCompletionVisible()).toBe(false);
  });

  it('clearCompletions() oculta e limpa', () => {
    bar.setCompletions(COMPLETIONS);
    bar.clearCompletions();
    expect(bar.isCompletionVisible()).toBe(false);
  });

  // setCompletionFilter
  it('setCompletionFilter filtra opções', () => {
    bar.setCompletions(COMPLETIONS);
    bar.setCompletionFilter('hel');
    const lines = bar.render(40, 10);
    const text = lines.map(l => stripAnsi(l)).join('\n');
    expect(text).toContain('/help');
    expect(text).not.toContain('/clear');
  });

  // minHeight
  it('minHeight() aumenta quando dropdown visível', () => {
    const baseHeight = bar.minHeight();
    bar.setCompletions(COMPLETIONS);
    expect(bar.minHeight()).toBeGreaterThan(baseHeight);
  });

  it('minHeight() volta ao normal quando dropdown oculto', () => {
    const baseHeight = bar.minHeight();
    bar.setCompletions(COMPLETIONS);
    bar.clearCompletions();
    expect(bar.minHeight()).toBe(baseHeight);
  });

  // render
  it('render() inclui linhas do dropdown antes do separator quando visível', () => {
    bar.setCompletions(COMPLETIONS);
    const lines = bar.render(40, 10);
    // Primeira linha deve ser do dropdown (não o separator)
    const first = stripAnsi(lines[0]);
    expect(first).toContain('/help');
    // Separator deve existir após as linhas do dropdown
    const sepIdx = lines.findIndex(l => stripAnsi(l).match(/^─+$/));
    expect(sepIdx).toBe(3); // 3 opções, depois separator
  });

  it('render() não inclui linhas extras quando dropdown oculto', () => {
    const lines = bar.render(40, 4);
    // Primeiro deve ser separator
    const first = stripAnsi(lines[0]);
    expect(first).toMatch(/^─+$/);
  });

  // handleKey — com dropdown visível
  it('handleKey(up) navega dropdown, não histórico', () => {
    bar.setHistory(['antigo']);
    bar.setCompletions(COMPLETIONS);
    // down para mover seleção para /clear
    bar.handleKey(key('down'));
    // up para voltar para /help
    bar.handleKey(key('up'));
    // Se fosse histórico, valor seria 'antigo'; como é dropdown, input fica vazio
    expect(bar.getValue()).toBe('');
  });

  it('handleKey(down) navega dropdown, não histórico', () => {
    bar.setHistory(['antigo']);
    bar.setCompletions(COMPLETIONS);
    bar.handleKey(key('down'));
    // Valor do input não muda (dropdown navega internamente)
    expect(bar.getValue()).toBe('');
  });

  it('handleKey(enter) chama onComplete e oculta dropdown', () => {
    bar.setCompletions(COMPLETIONS);
    let completed: DropdownOption | undefined;
    bar.onComplete = (opt) => { completed = opt; };
    bar.handleKey(key('enter'));
    expect(completed!.value).toBe('help');
    expect(bar.isCompletionVisible()).toBe(false);
  });

  it('handleKey(tab) chama onComplete e oculta dropdown', () => {
    bar.setCompletions(COMPLETIONS);
    bar.handleKey(key('down')); // selecionar /clear
    let completed: DropdownOption | undefined;
    bar.onComplete = (opt) => { completed = opt; };
    bar.handleKey(key('tab'));
    expect(completed!.value).toBe('clear');
    expect(bar.isCompletionVisible()).toBe(false);
  });

  it('handleKey(escape) oculta dropdown sem chamar onComplete', () => {
    bar.setCompletions(COMPLETIONS);
    let called = false;
    bar.onComplete = () => { called = true; };
    bar.handleKey(key('escape'));
    expect(bar.isCompletionVisible()).toBe(false);
    expect(called).toBe(false);
  });

  // compatibilidade com histórico quando dropdown oculto
  it('handleKey(up) ainda navega history quando dropdown oculto', () => {
    bar.setHistory(['cmd-antigo']);
    bar.handleKey(key('up'));
    expect(bar.getValue()).toBe('cmd-antigo');
  });

  it('onComplete é chamado com a opção correta após navegação', () => {
    bar.setCompletions(COMPLETIONS);
    bar.handleKey(key('down')); // /clear
    bar.handleKey(key('down')); // /model
    let completed: DropdownOption | undefined;
    bar.onComplete = (opt) => { completed = opt; };
    bar.handleKey(key('enter'));
    expect(completed!.value).toBe('model');
    expect(completed!.label).toBe('/model');
  });
});

describe('InputBar — blink propagation', () => {
  let bar: InputBar;

  beforeEach(() => {
    jest.useFakeTimers();
    bar = new InputBar();
  });

  afterEach(() => {
    bar.dispose();
    jest.useRealTimers();
  });

  test('onUpdate propaga do TextInput', () => {
    let updateCount = 0;
    bar.onUpdate = () => { updateCount++; };
    bar.onFocus();
    jest.advanceTimersByTime(530);
    expect(updateCount).toBeGreaterThanOrEqual(1);
  });

  test('dispose limpa timer do TextInput', () => {
    let updateCount = 0;
    bar.onUpdate = () => { updateCount++; };
    bar.onFocus();
    bar.dispose();
    jest.advanceTimersByTime(2000);
    expect(updateCount).toBe(0);
  });
});
