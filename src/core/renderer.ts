import type { Component } from './component';
import type { Terminal } from './terminal';
import { SYNC_START, SYNC_END, ERASE_DOWN, RESET, cursorUp } from './ansi';

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
      const output = SYNC_START + currentLines.join('\n') + RESET + SYNC_END;
      this.terminal.write(output);
      this.previousLines = currentLines;
      return;
    }

    // 3. Encontrar primeira linha diferente
    const maxLen = Math.max(currentLines.length, this.previousLines.length);
    let firstDiff = -1;
    for (let i = 0; i < maxLen; i++) {
      if (currentLines[i] !== this.previousLines[i]) {
        firstDiff = i;
        break;
      }
    }

    // 4. Nada mudou — retornar sem escrever nada
    if (firstDiff === -1) return;

    // 5. Calcular quantas linhas subir a partir do fim do render anterior
    const linesToMoveUp = this.previousLines.length - firstDiff;

    // 6. Construir output em buffer — single write ao final
    let output = SYNC_START;
    if (linesToMoveUp > 0) {
      output += cursorUp(linesToMoveUp);
    }
    output += ERASE_DOWN;
    for (let i = firstDiff; i < currentLines.length; i++) {
      output += currentLines[i] + RESET;
      if (i < currentLines.length - 1) output += '\n';
    }
    output += SYNC_END;

    // 7. Escrever tudo de uma vez — atomicidade
    this.terminal.write(output);
    this.previousLines = currentLines;
  }

  /**
   * Força full redraw no próximo render (usar após resize).
   */
  invalidate(): void {
    this.previousLines = [];
    this.isFirstRender = true;
  }
}
