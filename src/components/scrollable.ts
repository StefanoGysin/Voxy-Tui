import type { Component, KeyEvent } from '../core/component';

/** Altura "infinita" para render interno — filho deve renderizar todo conteúdo. */
const LARGE_HEIGHT = 10000;

export class Scrollable implements Component {
  focusable = true;

  private scrollOffset = 0;
  private lastHeight = 10;

  constructor(private readonly child: Component) {}

  /** Scroll para cima (conteúdo mais antigo / topo). */
  scrollUp(lines = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
  }

  /** Scroll para baixo (conteúdo mais recente / fundo). */
  scrollDown(lines = 1): void {
    this.scrollOffset += lines;
  }

  /** Vai para o início do conteúdo. */
  scrollToTop(): void {
    this.scrollOffset = 0;
  }

  /** Vai para o final do conteúdo. */
  scrollToBottom(): void {
    this.scrollOffset = LARGE_HEIGHT;
  }

  /** Offset atual (readonly para testes). */
  getScrollOffset(): number { return this.scrollOffset; }

  handleKey(event: KeyEvent): boolean {
    const pageSize = Math.max(1, this.lastHeight - 1);
    if (event.key === 'pageup')   { this.scrollUp(pageSize);   return true; }
    if (event.key === 'pagedown') { this.scrollDown(pageSize); return true; }
    return false;
  }

  render(width: number, height: number): string[] {
    this.lastHeight = height;

    const allLines = this.child.render(width, LARGE_HEIGHT);

    // Conteúdo cabe na view — sem scroll necessário
    if (allLines.length <= height) {
      this.scrollOffset = 0;
      const padding = height - allLines.length;
      return [...allLines, ...Array<string>(padding).fill('')];
    }

    // Clamp scrollOffset
    const maxOffset = Math.max(0, allLines.length - height);
    if (this.scrollOffset > maxOffset) this.scrollOffset = maxOffset;

    return allLines.slice(this.scrollOffset, this.scrollOffset + height);
  }
}
