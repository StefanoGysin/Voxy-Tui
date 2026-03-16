import type { Component, KeyEvent } from '../core/component';
import { RESET, DIM, FG_GRAY } from '../core/ansi';
import { padEndAnsi } from '../utils/width';

export class ThinkingBlock implements Component {
  focusable = true;
  private content = '';
  private collapsed = true;

  setContent(text: string): void { this.content = text; }
  isCollapsed(): boolean { return this.collapsed; }
  toggle(): void { this.collapsed = !this.collapsed; }

  handleKey(event: KeyEvent): boolean {
    if (event.key === 'return' || event.key === ' ') {
      this.toggle();
      return true;
    }
    return false;
  }

  minHeight(): number {
    if (this.collapsed) return 1;
    const lineCount = this.content ? this.content.split('\n').length : 0;
    return 1 + lineCount;
  }

  render(width: number, _height: number): string[] {
    const lineCount = this.content ? this.content.split('\n').length : 0;
    const icon  = `${FG_GRAY}${this.collapsed ? '▶' : '▼'}${RESET}`;
    const label = `${DIM}Chain of thought${RESET}`;
    const count = `${FG_GRAY}(${lineCount} linhas)${RESET}`;
    const headerLeft = `${icon} ${label}  ${count}`;

    const hintText = this.collapsed ? 'click expandir' : 'click recolher';
    const hintAnsi = `${FG_GRAY}${DIM}${hintText}${RESET}`;
    const header = width > 0
      ? padEndAnsi(headerLeft, width - hintText.length) + hintAnsi
      : headerLeft;

    if (this.collapsed) return [header];

    const contentLines = this.content
      .split('\n')
      .map(line => `  ${FG_GRAY}${line}${RESET}`);

    return [header, ...contentLines];
  }
}
