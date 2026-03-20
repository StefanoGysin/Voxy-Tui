import type { Component } from './component';
import type { Terminal } from './terminal';
import { SYNC_START, SYNC_END, ERASE_DOWN, ERASE_SCREEN, RESET, cursorTo } from './ansi';

export class Renderer {
  private previousLines: string[] = [];

  constructor(private readonly terminal: Terminal) {}

  /**
   * Full-redraw render com posicionamento absoluto.
   * Pipeline: Component[] → render() → string[] → skip-if-same → ANSI → single write
   * SYNC_START/SYNC_END garante atomicidade (sem flicker).
   */
  render(components: Component[]): void {
    const { columns, rows } = this.terminal.getSize();
    const currentLines = components.flatMap(c => c.render(columns, rows));

    // Skip se nada mudou (otimização — compara arrays completos)
    if (this.previousLines.length === currentLines.length &&
        currentLines.every((line, i) => line === this.previousLines[i])) {
      return;
    }

    // Full redraw com synchronized output (flicker-free)
    let output = SYNC_START;
    output += cursorTo(1, 1);  // Posição absoluta — sempre correto
    for (let i = 0; i < currentLines.length; i++) {
      output += currentLines[i] + RESET;
      if (i < currentLines.length - 1) output += '\n';
    }
    output += ERASE_DOWN;  // Limpa qualquer conteúdo residual abaixo
    output += cursorTo(currentLines.length, 1);  // Ancora cursor
    output += SYNC_END;

    this.terminal.write(output);
    this.previousLines = currentLines;
  }

  /**
   * Força full redraw no próximo render (usar após resize).
   * Emite ERASE_SCREEN + cursorTo(1,1) para limpar a tela visível antes do re-render,
   * evitando que frames anteriores da TUI sejam empurrados para o scrollback.
   */
  invalidate(): void {
    this.terminal.write(ERASE_SCREEN + cursorTo(1, 1));
    this.previousLines = [];
  }
}
