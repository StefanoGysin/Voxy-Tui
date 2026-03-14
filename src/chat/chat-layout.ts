import type { Component, KeyEvent, MouseClickEvent, MouseDragEvent } from '../core/component';
import { MessageList } from './message-list';
import { InputBar } from './input-bar';
import { StatusBar } from './status-bar';
import type { ToolActivityLog } from './tool-activity-log';

const SCROLL_LINES = 3;   // mouse wheel: linhas por evento
const PAGE_LINES   = 10;  // pageup/pagedown: linhas por evento
const SCROLL_THROTTLE_MS = 16; // throttle de mouse scroll (~60fps)

export class ChatLayout implements Component {
  readonly messageList: MessageList;
  readonly inputBar: InputBar;
  readonly statusBar: StatusBar;
  private activityLog: ToolActivityLog | null = null;
  private lastScrollAt = 0;
  private lastMessagesHeight = 0;

  constructor() {
    this.messageList = new MessageList();
    this.inputBar = new InputBar({ placeholder: 'Type a message…' });
    this.statusBar = new StatusBar();
  }

  /**
   * Define o ToolActivityLog a ser renderizado entre messageList e inputBar.
   * Passe null para ocultar.
   */
  setActivityLog(log: ToolActivityLog | null): void {
    this.activityLog = log;
  }

  render(width: number, height: number): string[] {
    const statusHeight = 1;
    const inputHeight = Math.max(this.inputBar.minHeight(), 2);
    const activityHeight = this.activityLog?.visibleLineCount() ?? 0;
    const messagesHeight = Math.max(0, height - statusHeight - inputHeight - activityHeight);
    this.lastMessagesHeight = messagesHeight;

    const messageLines = this.messageList.render(width, messagesHeight);
    const activityLines = activityHeight > 0
      ? this.activityLog!.render(width, activityHeight)
      : [];
    const inputLines = this.inputBar.render(width, inputHeight);
    const statusLines = this.statusBar.render(width, statusHeight);

    return [...messageLines, ...activityLines, ...inputLines, ...statusLines];
  }

  /**
   * Despacha um clique de mouse para o componente correto com base na posição Y.
   * MessageList ocupa as linhas 1..lastMessagesHeight do layout.
   */
  handleMouse(event: MouseClickEvent): boolean {
    if (event.y >= 1 && event.y <= this.lastMessagesHeight) {
      return this.messageList.handleMouse?.(event) ?? false;
    }
    return false;
  }

  /**
   * Despacha drag do mouse para o componente correto.
   * Drag na área de mensagens → MessageList.
   */
  handleMouseDrag(event: MouseDragEvent): boolean {
    if (event.y >= 1 && event.y <= this.lastMessagesHeight) {
      return this.messageList.handleMouseDrag?.(event) ?? false;
    }
    return false;
  }

  handleKey(event: KeyEvent): boolean {
    const { key } = event;

    // === Scroll de mensagens ===
    if (key === 'pageup' || key === 'pagedown' || key === 'scroll-up' || key === 'scroll-down') {
      // Throttle apenas para eventos de mouse (não teclado)
      if (key === 'scroll-up' || key === 'scroll-down') {
        const now = Date.now();
        if (now - this.lastScrollAt < SCROLL_THROTTLE_MS) return true;
        this.lastScrollAt = now;
      }

      if (key === 'pageup' || key === 'scroll-up') {
        this.messageList.scrollUp(key === 'pageup' ? PAGE_LINES : SCROLL_LINES);
      } else {
        this.messageList.scrollDown(key === 'pagedown' ? PAGE_LINES : SCROLL_LINES);
      }
      return true;
    }

    // === Tudo o resto vai para o InputBar ===
    return this.inputBar.handleKey(event);
  }

  minHeight(): number {
    const activityHeight = this.activityLog?.visibleLineCount() ?? 0;
    return this.inputBar.minHeight() + this.statusBar.minHeight() + 3 + activityHeight;
  }
}
