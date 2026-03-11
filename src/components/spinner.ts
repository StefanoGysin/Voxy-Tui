import type { Component } from '../core/component';
import { FG_YELLOW, RESET } from '../core/ansi';

export const BRAILLE_FRAMES = ['\u280B','\u2819','\u2839','\u2838','\u283C','\u2834','\u2826','\u2827','\u2807','\u280F'] as const;
export const FRAME_INTERVAL_MS = 80;

export class Spinner implements Component {
  private frameIndex = 0;
  private label: string;
  private active = false;
  private timer?: ReturnType<typeof setInterval>;
  private readonly onUpdate?: () => void;

  constructor(label = '', onUpdate?: () => void) {
    this.label = label;
    this.onUpdate = onUpdate;
  }

  start(label?: string): void {
    if (label !== undefined) this.label = label;
    this.active = true;
    this.frameIndex = 0;
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % BRAILLE_FRAMES.length;
      this.onUpdate?.();
    }, FRAME_INTERVAL_MS);
  }

  stop(): void {
    this.active = false;
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  setLabel(label: string): void {
    this.label = label;
    this.onUpdate?.();
  }

  render(_width: number, _height: number): string[] {
    if (!this.active) return [];
    const frame = BRAILLE_FRAMES[this.frameIndex];
    return [`${FG_YELLOW}${frame}${RESET} ${this.label}`];
  }
}
