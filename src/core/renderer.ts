import type { Component } from './component';
import type { Terminal } from './terminal';
import { SYNC_START, SYNC_END, ERASE_DOWN, ERASE_SCREEN, RESET, cursorUp, cursorTo } from './ansi';

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
      // cursorTo ancora cursor na última linha do frame — base consistente para diff renders.
      const output = SYNC_START + currentLines.join('\n') + RESET + cursorTo(currentLines.length, 1) + SYNC_END;
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
    // cursorTo ancora cursor na última linha do frame — base consistente para o próximo
    // cursorUp(N). Sem isto, cursor fica em length-1 e o próximo render deriva 1 row acima.
    output += cursorTo(currentLines.length, 1);
    output += SYNC_END;

    // 7. Escrever tudo de uma vez — atomicidade
    this.terminal.write(output);
    this.previousLines = currentLines;
  }

  /**
   * Força full redraw no próximo render (usar após resize).
   * Emite ERASE_SCREEN + cursorTo(1,1) para limpar a tela visível antes do re-render,
   * evitando que frames anteriores da TUI sejam empurrados para o scrollback.
   */
  invalidate(): void {
    // Limpar tela + cursor home antes do re-render.
    // Sem isso, o first-render path escreveria H linhas da posição atual do cursor
    // (meio do frame antigo), causando scrolls que levam partes da TUI ao scrollback.
    this.terminal.write(ERASE_SCREEN + cursorTo(1, 1));
    this.previousLines = [];
    this.isFirstRender = true;
  }
}
