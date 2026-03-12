import type { Component } from '../core/component';
import { RESET, DIM, FG_GRAY } from '../core/ansi';

export class StreamingThinkingIndicator implements Component {
  private startTime: number | null = null;
  private elapsedSeconds = 0;
  private timer?: ReturnType<typeof setInterval>;
  onUpdate?: () => void;

  /** Inicia o contador. Idempotente — segunda chamada é no-op. */
  start(): void {
    if (this.timer !== undefined) return;
    this.startTime = Date.now();
    this.elapsedSeconds = 0;
    this.timer = setInterval(() => {
      if (this.startTime !== null) {
        this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        this.onUpdate?.();
      }
    }, 1000);
  }

  /** Para o timer. render() retorna [] após stop(). */
  stop(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.startTime = null;
  }

  /** Alias de stop() — para padrão dispose() da biblioteca. */
  dispose(): void { this.stop(); }

  /** true enquanto o timer estiver ativo. */
  isActive(): boolean { return this.timer !== undefined; }

  /** Elapsed em segundos (inteiro). */
  getElapsedSeconds(): number { return this.elapsedSeconds; }

  render(_width: number, _height: number): string[] {
    if (!this.isActive()) return [];
    const timeStr = this.elapsedSeconds > 0 ? ` (${this.elapsedSeconds}s)` : '';
    return [`${FG_GRAY}${DIM}◆ Pensando...${timeStr}${RESET}`];
  }
}
