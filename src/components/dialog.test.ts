import { describe, it, expect, beforeEach } from 'bun:test';
import { Dialog } from './dialog';
import type { KeyEvent } from '../core/component';
import { stripAnsi } from '../utils/strip-ansi';

function key(k: string, mods: Partial<KeyEvent> = {}): KeyEvent {
  return { key: k, ctrl: false, meta: false, shift: false, raw: '', ...mods };
}

describe('Dialog', () => {
  let dialog: Dialog;

  beforeEach(() => {
    dialog = new Dialog({
      title: 'Confirmar',
      message: 'Deseja continuar com a operação?',
      buttons: ['Sim', 'Não', 'Cancelar'],
    });
  });

  // render
  it('render retorna linhas com border (primeira linha começa com "╭")', () => {
    const lines = dialog.render(50, 10);
    expect(lines[0]![0]).toBe('╭');
  });

  it('render inclui a message no output', () => {
    const lines = dialog.render(50, 10);
    const plain = lines.map(l => stripAnsi(l)).join('\n');
    expect(plain).toContain('Deseja continuar');
  });

  it('render inclui os botões no output', () => {
    const lines = dialog.render(50, 10);
    const plain = lines.map(l => stripAnsi(l)).join('\n');
    expect(plain).toContain('Sim');
    expect(plain).toContain('Não');
    expect(plain).toContain('Cancelar');
  });

  it('botão selecionado aparece com "[" e "]" delimitadores', () => {
    const lines = dialog.render(50, 10);
    const plain = lines.map(l => stripAnsi(l)).join('\n');
    expect(plain).toContain('[ Sim ]');
  });

  // handleKey
  it('right move seleção para o próximo botão', () => {
    dialog.handleKey(key('right'));
    expect(dialog.getSelectedButton()).toBe(1);
  });

  it('left move seleção para o botão anterior (clamp em 0)', () => {
    dialog.handleKey(key('left'));
    expect(dialog.getSelectedButton()).toBe(0);
  });

  it('enter chama onSelect com botão e índice corretos', () => {
    dialog.handleKey(key('right')); // "Não"
    let calledButton = '';
    let calledIndex = -1;
    dialog.onSelect = (btn, idx) => { calledButton = btn; calledIndex = idx; };
    dialog.handleKey(key('enter'));
    expect(calledButton).toBe('Não');
    expect(calledIndex).toBe(1);
  });

  it('escape chama onSelect com botão 0 (primeiro)', () => {
    dialog.handleKey(key('right')); // move to "Não"
    let calledIndex = -1;
    dialog.onSelect = (_btn, idx) => { calledIndex = idx; };
    dialog.handleKey(key('escape'));
    expect(calledIndex).toBe(0);
  });

  it('up/down retornam true (absorvidos)', () => {
    expect(dialog.handleKey(key('up'))).toBe(true);
    expect(dialog.handleKey(key('down'))).toBe(true);
  });

  // update
  it('update() atualiza message sem perder selectedButton', () => {
    dialog.handleKey(key('right')); // selectedButton = 1
    dialog.update({ message: 'Nova mensagem' });
    expect(dialog.getSelectedButton()).toBe(1);
    const lines = dialog.render(50, 10);
    const plain = lines.map(l => stripAnsi(l)).join('\n');
    expect(plain).toContain('Nova mensagem');
  });
});
