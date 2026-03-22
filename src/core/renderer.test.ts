import { describe, expect, test } from 'bun:test';
import { Renderer } from './renderer';
import { MockTerminal } from '../test/setup';

// Componente helper para testes
function makeComponent(lines: string[]) {
  return {
    render: (_width: number, _height: number) => lines,
  };
}

describe('Renderer', () => {
  test('primeiro render escreve todas as linhas', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);
    renderer.render([makeComponent(['linha 1', 'linha 2'])]);
    const output = term.getOutput();
    expect(output).toContain('linha 1');
    expect(output).toContain('linha 2');
  });

  test('render idêntico não escreve nada', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);
    const components = [makeComponent(['linha 1'])];
    renderer.render(components);
    term.reset();
    renderer.render(components); // segundo render idêntico
    expect(term.getOutput()).toBe('');
  });

  test('render com mudança parcial faz diff (só a partir da primeira diferença)', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);
    // Usar 10 linhas para que 1 mudança (10%) fique abaixo do threshold de 15%
    const lines = Array.from({ length: 10 }, (_, i) => `linha ${i}`);
    renderer.render([makeComponent(lines)]);
    term.reset();
    const changed = [...lines];
    changed[5] = 'linha 5 MUDOU';
    renderer.render([makeComponent(changed)]);
    const output = term.getOutput();
    expect(output).not.toContain('linha 0'); // diff pula linhas inalteradas
    expect(output).toContain('linha 5 MUDOU');
  });

  test('invalidate força full redraw no próximo render', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);
    renderer.render([makeComponent(['linha 1'])]);
    term.reset();
    renderer.invalidate();
    renderer.render([makeComponent(['linha 1'])]); // conteúdo idêntico mas invalidado
    expect(term.getOutput()).toContain('linha 1');
  });

  test('invalidate() emite ERASE_SCREEN + cursorTo(1,1) para evitar ghost text', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);
    renderer.invalidate();
    const output = term.getOutput();
    expect(output).toContain('\x1b[2J');    // ERASE_SCREEN
    expect(output).toContain('\x1b[1;1H'); // cursorTo(1, 1)
  });

  test('invalidate() força first render path na próxima chamada', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);

    // Primeiro render
    const comp = makeComponent(['linha A']);
    renderer.render([comp]);
    term.reset();

    // Segundo render — sem mudança — não escreve nada
    renderer.render([comp]);
    expect(term.getOutput()).toBe('');

    // invalidate() + render — deve escrever novamente (full redraw)
    renderer.invalidate();
    term.reset();
    renderer.render([comp]);
    expect(term.getOutput()).not.toBe('');
  });

  test('primeiro render ancora cursor na última linha do conteúdo (cursorTo N)', () => {
    const term = new MockTerminal(80, 5);
    const renderer = new Renderer(term);
    renderer.render([makeComponent(['a', 'b', 'c', 'd', 'e'])]);
    expect(term.getOutput()).toContain('\x1b[5;1H'); // cursorTo(5, 1) — última linha do conteúdo
  });

  test('re-render ancora cursor na última linha do conteúdo (sem drift)', () => {
    const term = new MockTerminal(80, 5);
    const renderer = new Renderer(term);
    renderer.render([makeComponent(['a', 'b', 'c', 'd', 'e'])]);
    term.reset();
    renderer.render([makeComponent(['a', 'b', 'c', 'd', 'X'])]);
    expect(term.getOutput()).toContain('\x1b[5;1H'); // cursorTo(5, 1) — última linha do conteúdo
  });

  test('synchronized output envolve cada render', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);
    renderer.render([makeComponent(['linha 1'])]);
    const output = term.getOutput();
    expect(output).toContain('\x1b[?2026h'); // SYNC_START
    expect(output).toContain('\x1b[?2026l'); // SYNC_END
  });
});
