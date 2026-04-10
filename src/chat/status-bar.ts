import type { Component } from '../core/component';
import { RESET } from '../core/ansi';
import { theme } from '../core/theme';
import { BRAILLE_FRAMES, FRAME_INTERVAL_MS } from '../components/spinner';
import { measureWidth } from '../utils/width';
import { stripAnsi } from '../utils/strip-ansi';

export type StatusMode = 'idle' | 'streaming' | 'thinking' | 'error';
export type ThinkingLevel = 'off' | 'auto' | 'high' | 'max';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(Math.floor(n / 100_000) / 10).toFixed(1)}M`;
  if (n >= 100_000) return `${Math.floor(n / 1_000)}k`;
  if (n >= 1_000) return `${(Math.floor(n / 100) / 10).toFixed(1)}k`;
  return `${n}`;
}

export class StatusBar implements Component {
  private mode: StatusMode = 'idle';
  private model = '';
  private status = '';
  private contextUsed = 0;
  private contextTotal = 0;
  private thinkingLevel: ThinkingLevel = 'off';
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

  setContextUsage(used: number, total: number): void {
    this.contextUsed = used;
    this.contextTotal = total;
  }

  setThinking(level: ThinkingLevel): void {
    this.thinkingLevel = level;
  }

  dispose(): void {
    this.stopTimer();
  }

  minHeight(): number {
    return 1;
  }

  render(width: number, _height: number): string[] {
    const sep = ` ${theme.statusSeparatorFg}│${RESET} `;

    // Left section — status
    let left = '';
    if (this.mode === 'streaming' || this.mode === 'thinking') {
      const frame = BRAILLE_FRAMES[this.frameIndex % BRAILLE_FRAMES.length];
      const label = this.status || 'Generating…';
      left = `${theme.statusStreamingFg}${frame}${RESET} ${label}`;
    } else if (this.mode === 'error') {
      left = `${theme.statusErrorFg}✗${RESET} ${this.status}`;
    } else if (this.status) {
      left = `${theme.statusIdleFg}${this.status}${RESET}`;
    }

    // Center section — model + context
    let center = '';
    if (this.model) {
      center = `${theme.statusModelFg}${this.model}${RESET}`;
      if (this.contextTotal > 0) {
        const ratio = this.contextUsed / this.contextTotal;
        const ctxFg = ratio > 0.8
          ? theme.statusContextDangerFg
          : ratio >= 0.6
            ? theme.statusContextWarningFg
            : theme.statusContextNormalFg;
        center += `: ${ctxFg}${formatTokens(this.contextUsed)} / ${formatTokens(this.contextTotal)}${RESET}`;
      }
    }

    // Right section — thinking
    let right = '';
    if (this.thinkingLevel !== 'off') {
      right = `${theme.statusThinkingFg}Thinking${RESET} [${theme.statusThinkingDotFg}● ${this.thinkingLevel}${RESET}]`;
    }

    // Join non-empty sections with separator
    const rightParts = [center, right].filter(Boolean);
    const rightSide = rightParts.join(sep);

    const leftWidth = measureWidth(stripAnsi(left));
    const rightWidth = measureWidth(stripAnsi(rightSide));
    const padding = ' '.repeat(Math.max(1, width - leftWidth - rightWidth));

    if (left && rightSide) {
      return [left + padding + rightSide];
    }
    if (left) {
      return [left + ' '.repeat(Math.max(0, width - leftWidth))];
    }
    if (rightSide) {
      return [' '.repeat(Math.max(0, width - rightWidth)) + rightSide];
    }
    return [' '.repeat(width)];
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
