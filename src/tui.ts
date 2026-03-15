import { ProcessTerminal, Renderer, RenderScheduler } from './core';
import type { Terminal } from './core';
import { CURSOR_HIDE, CURSOR_SHOW,
         ENABLE_MOUSE_TRACKING, DISABLE_MOUSE_TRACKING } from './core/ansi';
import { ChatLayout } from './chat/chat-layout';

export interface TUIOptions {
  terminal?: Terminal;
  fps?: number;
}

export class TUI {
  readonly layout: ChatLayout;
  private readonly terminal: Terminal;
  private readonly renderer: Renderer;
  private readonly scheduler: RenderScheduler;
  private running = false;
  private resizeListener?: () => void;

  constructor(options?: TUIOptions) {
    this.terminal = options?.terminal ?? new ProcessTerminal();
    this.renderer = new Renderer(this.terminal);
    this.scheduler = new RenderScheduler(() => this.doRender(), options?.fps ?? 30);
    this.layout = new ChatLayout();

    this.layout.statusBar.onUpdate = () => this.scheduler.scheduleRender();
  }

  /** Inicia o loop de render e escuta resize do terminal. */
  start(): void {
    if (this.running) return;
    this.running = true;

    // Buffer primário: esconde cursor + mouse tracking
    this.terminal.write('\r\n' + CURSOR_HIDE + ENABLE_MOUSE_TRACKING);

    this.resizeListener = () => {
      this.renderer.invalidate();
      this.scheduler.scheduleRender();
    };
    process.stdout.on('resize', this.resizeListener);

    this.scheduler.renderNow();
  }

  /** Para o loop, limpa timers e listeners. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.scheduler.dispose();
    this.layout.statusBar.dispose();

    // Desabilitar mouse tracking + restaurar cursor
    this.terminal.write(DISABLE_MOUSE_TRACKING + CURSOR_SHOW + '\r\n');

    if (this.resizeListener) {
      process.stdout.removeListener('resize', this.resizeListener);
      this.resizeListener = undefined;
    }
  }

  /** Agenda um render para o próximo frame. */
  scheduleRender(): void {
    this.scheduler.scheduleRender();
  }

  /** Força render imediato. */
  renderNow(): void {
    this.scheduler.renderNow();
  }

  private doRender(): void {
    this.renderer.render([this.layout]);
  }
}
