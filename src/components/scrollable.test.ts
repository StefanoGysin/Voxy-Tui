import { describe, it, expect } from 'bun:test';
import type { Component } from '../core/component';
import { Scrollable } from './scrollable';
import { Text } from './text';

/** Componente auxiliar que retorna N linhas numeradas */
function makeLines(n: number): Component {
  return {
    render: (_w: number, _h: number) =>
      Array.from({ length: n }, (_, i) => `linha ${i + 1}`)
  };
}

describe('Scrollable', () => {
  it('conteúdo menor que view — sem scroll, padding abaixo', () => {
    const s = new Scrollable(makeLines(3));
    const lines = s.render(80, 10);
    expect(lines).toHaveLength(10);
    expect(lines[0]).toBe('linha 1');
    expect(lines[3]).toBe(''); // padding
  });

  it('scrollOffset inicial = 0', () => {
    const s = new Scrollable(makeLines(20));
    expect(s.getScrollOffset()).toBe(0);
  });

  it('render janela correta (offset=0 → primeiras linhas)', () => {
    const s = new Scrollable(makeLines(20));
    const lines = s.render(80, 5);
    expect(lines[0]).toBe('linha 1');
    expect(lines[4]).toBe('linha 5');
  });

  it('scrollDown() move para baixo', () => {
    const s = new Scrollable(makeLines(20));
    s.render(80, 5);
    s.scrollDown(3);
    const lines = s.render(80, 5);
    expect(lines[0]).toBe('linha 4');
    expect(lines[4]).toBe('linha 8');
  });

  it('scrollUp() volta para cima', () => {
    const s = new Scrollable(makeLines(20));
    s.render(80, 5);
    s.scrollDown(5);
    s.scrollUp(3);
    const lines = s.render(80, 5);
    expect(lines[0]).toBe('linha 3');
  });

  it('scrollUp() não vai abaixo de 0', () => {
    const s = new Scrollable(makeLines(20));
    s.scrollUp(100);
    expect(s.getScrollOffset()).toBe(0);
  });

  it('scrollDown() é clampado ao máximo no render', () => {
    const s = new Scrollable(makeLines(10));
    s.scrollDown(100);
    const lines = s.render(80, 5);
    // maxOffset = 10 - 5 = 5 → mostra linhas 6..10
    expect(lines[0]).toBe('linha 6');
    expect(lines[4]).toBe('linha 10');
  });

  it('scrollToTop() vai para offset 0', () => {
    const s = new Scrollable(makeLines(20));
    s.scrollDown(10);
    s.scrollToTop();
    expect(s.getScrollOffset()).toBe(0);
  });

  it('scrollToBottom() vai para o final', () => {
    const s = new Scrollable(makeLines(20));
    s.scrollToBottom();
    const lines = s.render(80, 5);
    expect(lines[4]).toBe('linha 20');
  });

  it('handleKey pagedown move para baixo', () => {
    const s = new Scrollable(makeLines(30));
    s.render(80, 10); // lastHeight = 10
    s.handleKey({ key: 'pagedown', ctrl: false, meta: false, shift: false, raw: '' });
    // pageSize = lastHeight - 1 = 9
    expect(s.getScrollOffset()).toBe(9);
  });

  it('handleKey pageup move para cima', () => {
    const s = new Scrollable(makeLines(30));
    s.render(80, 10);
    s.scrollDown(15);
    s.handleKey({ key: 'pageup', ctrl: false, meta: false, shift: false, raw: '' });
    expect(s.getScrollOffset()).toBe(6);
  });

  it('handleKey retorna false para teclas desconhecidas', () => {
    const s = new Scrollable(makeLines(5));
    expect(s.handleKey({ key: 'x', ctrl: false, meta: false, shift: false, raw: '' })).toBe(false);
  });

  it('wrap de Component — usa Text real', () => {
    const t = new Text('linha 1\nlinha 2\nlinha 3\nlinha 4\nlinha 5\nlinha 6');
    const s = new Scrollable(t);
    s.scrollDown(2);
    const lines = s.render(80, 3);
    expect(lines[0]).toContain('linha 3');
  });
});
