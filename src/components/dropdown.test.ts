import { describe, it, expect, beforeEach } from 'bun:test';
import { Dropdown } from './dropdown';
import type { DropdownOption } from './dropdown';
import type { KeyEvent } from '../core/component';
import { stripAnsi } from '../utils/strip-ansi';

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { key: k, ctrl: false, meta: false, shift: false, raw: '', ...mods };
}

const OPTIONS: DropdownOption[] = [
  { label: 'Alpha', value: 'a' },
  { label: 'Beta', value: 'b', description: 'second letter' },
  { label: 'Gamma', value: 'g' },
  { label: 'Delta', value: 'd' },
  { label: 'Epsilon', value: 'e' },
];

describe('Dropdown', () => {
  let dd: Dropdown;

  beforeEach(() => {
    dd = new Dropdown();
    dd.setOptions(OPTIONS);
  });

  // construção e estado inicial
  it('começa oculto', () => {
    expect(dd.isVisible()).toBe(false);
  });

  it('render() retorna [] quando oculto', () => {
    expect(dd.render(40, 10)).toEqual([]);
  });

  // setOptions e setFilter
  it('setOptions popula todas as opções', () => {
    dd.show();
    expect(dd.getFilteredOptions()).toHaveLength(5);
  });

  it('setFilter filtra corretamente (case-insensitive, substring)', () => {
    dd.show();
    dd.setFilter('al');
    expect(dd.getFilteredOptions().map(o => o.value)).toEqual(['a']);
  });

  it('setFilter vazio mostra todas as opções', () => {
    dd.show();
    dd.setFilter('al');
    dd.setFilter('');
    expect(dd.getFilteredOptions()).toHaveLength(5);
  });

  it('setFilter reseta selectedIndex para 0', () => {
    dd.show();
    dd.handleKey(key('down'));
    dd.handleKey(key('down'));
    dd.setFilter('a');
    expect(dd.getSelected()?.value).toBe('a'); // Alpha, index 0
  });

  // show/hide/toggle
  it('show() torna visível', () => {
    dd.show();
    expect(dd.isVisible()).toBe(true);
  });

  it('hide() oculta', () => {
    dd.show();
    dd.hide();
    expect(dd.isVisible()).toBe(false);
  });

  it('toggle() alterna visibilidade', () => {
    dd.toggle();
    expect(dd.isVisible()).toBe(true);
    dd.toggle();
    expect(dd.isVisible()).toBe(false);
  });

  // render visível
  it('render retorna até maxVisible linhas', () => {
    const small = new Dropdown({ maxVisible: 3 });
    small.setOptions(OPTIONS);
    small.show();
    expect(small.render(40, 10)).toHaveLength(3);
  });

  it('render mostra "(nenhum resultado)" quando filtro sem match', () => {
    dd.show();
    dd.setFilter('zzz');
    const lines = dd.render(40, 10);
    expect(lines).toHaveLength(1);
    expect(stripAnsi(lines[0]!)).toContain('(nenhum resultado)');
  });

  it('item selecionado tem prefixo ">"', () => {
    dd.show();
    const lines = dd.render(40, 10);
    expect(stripAnsi(lines[0]!)).toMatch(/^> /);
  });

  it('item não selecionado tem prefixo "  "', () => {
    dd.show();
    const lines = dd.render(40, 10);
    expect(stripAnsi(lines[1]!)).toMatch(/^ {2}/);
  });

  // handleKey
  it('handleKey retorna false quando oculto', () => {
    expect(dd.handleKey(key('down'))).toBe(false);
  });

  it('down move seleção para baixo', () => {
    dd.show();
    dd.handleKey(key('down'));
    expect(dd.getSelected()?.value).toBe('b');
  });

  it('up move seleção para cima', () => {
    dd.show();
    dd.handleKey(key('down'));
    dd.handleKey(key('down'));
    dd.handleKey(key('up'));
    expect(dd.getSelected()?.value).toBe('b');
  });

  it('up clamp em 0', () => {
    dd.show();
    dd.handleKey(key('up'));
    expect(dd.getSelected()?.value).toBe('a');
  });

  it('down clamp no último item', () => {
    dd.show();
    for (let i = 0; i < 20; i++) dd.handleKey(key('down'));
    expect(dd.getSelected()?.value).toBe('e');
  });

  it('enter chama onSelect com opção correta e oculta', () => {
    dd.show();
    dd.handleKey(key('down')); // Beta
    let called: DropdownOption | undefined;
    dd.onSelect = (opt) => { called = opt; };
    dd.handleKey(key('enter'));
    expect(called!.value).toBe('b');
    expect(dd.isVisible()).toBe(false);
  });

  it('escape oculta sem chamar onSelect', () => {
    dd.show();
    let called = false;
    dd.onSelect = () => { called = true; };
    dd.handleKey(key('escape'));
    expect(dd.isVisible()).toBe(false);
    expect(called).toBe(false);
  });

  it('getSelected() retorna opção highlighted correta', () => {
    dd.show();
    dd.handleKey(key('down'));
    dd.handleKey(key('down'));
    expect(dd.getSelected()?.value).toBe('g');
  });

  it('getSelected() retorna null quando lista filtrada vazia', () => {
    dd.show();
    dd.setFilter('zzz');
    expect(dd.getSelected()).toBeNull();
  });

  // scroll interno
  it('scroll ajusta quando selectedIndex ultrapassa maxVisible', () => {
    const small = new Dropdown({ maxVisible: 2 });
    small.setOptions(OPTIONS);
    small.show();
    small.handleKey(key('down')); // index 1
    small.handleKey(key('down')); // index 2 — fora da janela [0,1]
    const lines = small.render(40, 10);
    // Deve mostrar index 1 e 2 (Beta, Gamma)
    expect(stripAnsi(lines[1]!)).toContain('Gamma');
    expect(stripAnsi(lines[0]!)).toContain('Beta');
  });
});
