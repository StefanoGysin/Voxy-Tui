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

  test('render com mudança parcial re-renderiza da primeira linha diferente', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);
    renderer.render([makeComponent(['linha A', 'linha B', 'linha C'])]);
    term.reset();
    renderer.render([makeComponent(['linha A', 'linha B MUDOU', 'linha C'])]);
    const output = term.getOutput();
    expect(output).not.toContain('linha A'); // linha 0 não mudou, não deve ser reescrita
    expect(output).toContain('linha B MUDOU');
    expect(output).toContain('linha C');
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

  test('synchronized output envolve cada render', () => {
    const term = new MockTerminal();
    const renderer = new Renderer(term);
    renderer.render([makeComponent(['linha 1'])]);
    const output = term.getOutput();
    expect(output).toContain('\x1b[?2026h'); // SYNC_START
    expect(output).toContain('\x1b[?2026l'); // SYNC_END
  });
});
