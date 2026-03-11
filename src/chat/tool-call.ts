import type { Component, KeyEvent } from '../core/component';
import { RESET, BOLD, DIM, FG_CYAN, FG_GREEN, FG_YELLOW, FG_RED, FG_GRAY } from '../core/ansi';
import { wrapText } from '../utils/wrap';
import { BRAILLE_FRAMES, FRAME_INTERVAL_MS } from '../components/spinner';

export type ToolStatus = 'running' | 'done' | 'error';

export class ToolCall implements Component {
  focusable = true;
  private input  = '';
  private output = '';
  private status: ToolStatus = 'running';
  private collapsed = true;
  private frameIndex = 0;
  private timer?: ReturnType<typeof setInterval>;
  onUpdate?: () => void;

  constructor(private readonly name: string) {
    this.startTimer();
  }

  setInput(input: string): void   { this.input = input; }
  setOutput(output: string): void { this.output = output; }

  setStatus(status: ToolStatus): void {
    this.status = status;
    if (status === 'running') {
      this.startTimer();
    } else {
      this.stopTimer();
    }
  }

  toggle(): void { this.collapsed = !this.collapsed; }

  handleKey(event: KeyEvent): boolean {
    if (event.key === 'return' || event.key === ' ') {
      this.toggle();
      return true;
    }
    return false;
  }

  dispose(): void { this.stopTimer(); }

  render(width: number, _height: number): string[] {
    const icon   = this.statusIcon();
    const header = `${icon} ${FG_CYAN}${BOLD}${this.name}${RESET}`;

    if (this.collapsed) return [header];

    const lines = [header];

    if (this.input) {
      lines.push(`  ${FG_GRAY}${DIM}Input:${RESET}`);
      for (const line of wrapText(this.input, Math.max(1, width - 4))) {
        lines.push(`    ${line}`);
      }
    }

    if (this.output) {
      lines.push(`  ${FG_GRAY}${DIM}Output:${RESET}`);
      for (const line of wrapText(this.output, Math.max(1, width - 4))) {
        lines.push(`    ${line}`);
      }
    }

    return lines;
  }

  private statusIcon(): string {
    switch (this.status) {
      case 'running': {
        const frame = BRAILLE_FRAMES[this.frameIndex % BRAILLE_FRAMES.length];
        return `${FG_YELLOW}${frame}${RESET}`;
      }
      case 'done':  return `${FG_GREEN}✓${RESET}`;
      case 'error': return `${FG_RED}✗${RESET}`;
    }
  }

  private startTimer(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % BRAILLE_FRAMES.length;
      this.onUpdate?.();
    }, FRAME_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
