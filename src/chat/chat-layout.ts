import type { Component, KeyEvent, MouseClickEvent, MouseDragEvent } from '../core/component';
import { MessageList } from './message-list';
import { InputBar } from './input-bar';
import { StatusBar } from './status-bar';
import type { ToolActivityLog } from './tool-activity-log';

export class ChatLayout implements Component {
  readonly messageList: MessageList;
  readonly inputBar: InputBar;
  readonly statusBar: StatusBar;
  private activityLog: ToolActivityLog | null = null;
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

    // === Bloquear Enter enquanto seleção de texto ativa (evitar envio acidental) ===
    if (key === 'return' && this.messageList.isSelectionActive()) {
      return true   // consume: não enviar ao InputBar
    }

    // === Tudo o resto vai para o InputBar ===
    // Nota: scroll (pageup/pagedown/scroll-up/scroll-down) é gerenciado nativamente
    // pelo terminal no modelo de buffer primário. Não interceptar aqui.
    return this.inputBar.handleKey(event);
  }

  minHeight(): number {
    const activityHeight = this.activityLog?.visibleLineCount() ?? 0;
    return this.inputBar.minHeight() + this.statusBar.minHeight() + 3 + activityHeight;
  }
}
