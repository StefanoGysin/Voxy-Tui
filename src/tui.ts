import { ProcessTerminal, Renderer, RenderScheduler } from './core';
import type { Terminal } from './core';
import { CURSOR_HIDE, CURSOR_SHOW,
         ENABLE_MOUSE_TRACKING, DISABLE_MOUSE_TRACKING,
         FOCUS_EVENT_ENABLE, FOCUS_EVENT_DISABLE,
         ERASE_SCREEN, cursorTo,
         ENTER_ALT_SCREEN, EXIT_ALT_SCREEN } from './core/ansi';
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

    // Alternate screen buffer: cria buffer limpo separado do histórico.
    // Funciona em todos os terminais (VS Code, PowerShell, xterm, Windows Terminal).
    // ERASE_SCREEN + cursorTo(1,1) garante estado known-good para o primeiro frame.
    this.terminal.write(
      ENTER_ALT_SCREEN + CURSOR_HIDE + ENABLE_MOUSE_TRACKING + FOCUS_EVENT_ENABLE +
      ERASE_SCREEN + cursorTo(1, 1)
    );

    this.layout.inputBar.onFocus();

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
    this.layout.inputBar.dispose();
    this.layout.statusBar.dispose();

    // Restaurar terminal: desliga mouse, mostra cursor, sai do alternate screen.
    // EXIT_ALT_SCREEN restaura o buffer original com histórico intacto.
    this.terminal.write(FOCUS_EVENT_DISABLE + DISABLE_MOUSE_TRACKING + CURSOR_SHOW + EXIT_ALT_SCREEN);

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
