import type { Component } from './component';
import type { Terminal } from './terminal';
import { SYNC_START, SYNC_END, ERASE_DOWN, ERASE_SCREEN, RESET, cursorTo } from './ansi';

export class Renderer {
  private previousLines: string[] = [];
  private isFirstRender = true;

  constructor(private readonly terminal: Terminal) {}

  /**
   * Render all components to the terminal using line-level diff.
   * Pipeline: Component[] → render() → string[] → diff → ANSI → single write
   */
  render(components: Component[]): void {
    const { columns, rows } = this.terminal.getSize();

    // 1. Coletar linhas de todos os componentes
    const currentLines = components.flatMap(c => c.render(columns, rows));

    // 2. Primeiro render: escrever tudo diretamente, sem diff
    if (this.isFirstRender) {
      this.isFirstRender = false;
      const output = SYNC_START + currentLines.join('\n') + RESET + cursorTo(currentLines.length, 1) + SYNC_END;
      this.terminal.write(output);
      this.previousLines = currentLines;
      return;
    }

    // 3. Detectar se o número total de linhas mudou — se sim, full redraw
    if (currentLines.length !== this.previousLines.length) {
      const output = SYNC_START + ERASE_SCREEN + cursorTo(1, 1) +
        currentLines.join('\n') + RESET + cursorTo(currentLines.length, 1) + SYNC_END;
      this.terminal.write(output);
      this.previousLines = currentLines;
      return;
    }

    // 4. Encontrar primeira e última linha diferentes
    let firstDiff = -1;
    let lastDiff = -1;
    for (let i = 0; i < currentLines.length; i++) {
      if (currentLines[i] !== this.previousLines[i]) {
        if (firstDiff === -1) firstDiff = i;
        lastDiff = i;
      }
    }

    // 5. Nada mudou — retornar sem escrever nada
    if (firstDiff === -1) return;

    // 6. Se mais de 15% das linhas mudaram, full redraw é mais eficiente
    const changedCount = lastDiff - firstDiff + 1;
    if (changedCount > currentLines.length * 0.15) {
      const output = SYNC_START + ERASE_SCREEN + cursorTo(1, 1) +
        currentLines.join('\n') + RESET + cursorTo(currentLines.length, 1) + SYNC_END;
      this.terminal.write(output);
      this.previousLines = currentLines;
      return;
    }

    // 7. Diff parcial: ERASE_DOWN do firstDiff e reescrever dali para baixo
    let output = SYNC_START;
    output += cursorTo(firstDiff + 1, 1);
    output += ERASE_DOWN;
    for (let i = firstDiff; i < currentLines.length; i++) {
      output += currentLines[i] + RESET;
      if (i < currentLines.length - 1) output += '\n';
    }
    output += cursorTo(currentLines.length, 1);
    output += SYNC_END;

    // 8. Escrever tudo de uma vez — atomicidade
    this.terminal.write(output);
    this.previousLines = currentLines;
  }

  /**
   * Força full redraw no próximo render (usar após resize).
   */
  invalidate(): void {
    this.terminal.write(ERASE_SCREEN + cursorTo(1, 1));
    this.previousLines = [];
    this.isFirstRender = true;
  }
}
