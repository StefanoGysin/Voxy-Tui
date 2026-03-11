import type { Component } from '../core/component';
import { RESET, FG_CYAN, FG_GRAY, FG_RED, FG_YELLOW } from '../core/ansi';
import { BRAILLE_FRAMES, FRAME_INTERVAL_MS } from '../components/spinner';
import { measureWidth } from '../utils/width';
import { stripAnsi } from '../utils/strip-ansi';

export type StatusMode = 'idle' | 'streaming' | 'thinking' | 'error';

export class StatusBar implements Component {
  private mode: StatusMode = 'idle';
  private model = '';
  private status = '';
  private inputTokens = 0;
  private outputTokens = 0;
  private frameIndex = 0;
  private timer?: ReturnType<typeof setInterval>;

  onUpdate?: () => void;

  setMode(mode: StatusMode): void {
    this.mode = mode;
    if (mode === 'streaming' || mode === 'thinking') {
      this.startTimer();
    } else {
      this.stopTimer();
    }
  }

  setModel(name: string): void {
    this.model = name;
  }

  setStatus(text: string): void {
    this.status = text;
  }

  setTokens(input: number, output: number): void {
    this.inputTokens = input;
    this.outputTokens = output;
  }

  dispose(): void {
    this.stopTimer();
  }

  minHeight(): number {
    return 1;
  }

  render(width: number, _height: number): string[] {
    // Left section
    let left = '';
    if (this.mode === 'streaming' || this.mode === 'thinking') {
      const frame = BRAILLE_FRAMES[this.frameIndex % BRAILLE_FRAMES.length];
      const label = this.status || 'Generating…';
      left = `${FG_YELLOW}${frame}${RESET} ${label}`;
    } else if (this.mode === 'error') {
      left = `${FG_RED}✗${RESET} ${this.status}`;
    } else if (this.status) {
      left = `${FG_GRAY}${this.status}${RESET}`;
    }

    // Right section
    let right = '';
    if (this.model) {
      right = `${FG_CYAN}${this.model}${RESET}`;
    }
    if (this.inputTokens > 0 || this.outputTokens > 0) {
      right += ` ${FG_GRAY}↑${this.inputTokens} ↓${this.outputTokens}${RESET}`;
    }

    const leftWidth = measureWidth(stripAnsi(left));
    const rightWidth = measureWidth(stripAnsi(right));
    const padding = ' '.repeat(Math.max(1, width - leftWidth - rightWidth));

    return [left + padding + right];
  }

  private startTimer(): void {
    if (this.timer !== undefined) return;
    this.frameIndex = 0;
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
