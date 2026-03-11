import { ProcessTerminal, Renderer, RenderScheduler } from './core';
import type { Terminal } from './core';
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
