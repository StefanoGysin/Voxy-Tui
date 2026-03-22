import type { Component, KeyEvent, MouseClickEvent, MouseDragEvent } from '../core/component';
import type { Sidebar } from '../components/sidebar';
import { MessageList } from './message-list';
import { InputBar } from './input-bar';
import { StatusBar } from './status-bar';
import type { ToolActivityLog } from './tool-activity-log';
import type { Toast } from '../components/toast';
import { fitWidth } from '../utils/width';

/**
 * Interface para o slot de permission dialog inline.
 * O ChatLayout chama render() para obter as linhas e handleKey() para delegar input.
 */
export interface PermissionDialogSlot {
  /** Renderiza o dialog com a largura dada. Retorna linhas (pode ser 0 se inativo). */
  render(width: number): string[];
  /** Processa tecla. Retorna true se consumiu o evento. */
  handleKey(event: KeyEvent): boolean;
  /** Número de linhas que o dialog ocupa agora (0 = inativo). */
  lineCount(): number;
  /** Opcional: processa click de mouse. Retorna true se consumiu o evento. */
  handleMouse?(event: MouseClickEvent): boolean;
}

const SCROLL_LINES = 3;   // mouse wheel: linhas por evento
const PAGE_LINES   = 10;  // pageup/pagedown: linhas por evento
const SCROLL_THROTTLE_MS = 16; // throttle de mouse scroll (~60fps)

export class ChatLayout implements Component {
  readonly messageList: MessageList;
  readonly inputBar: InputBar;
  readonly statusBar: StatusBar;
  private activityLog: ToolActivityLog | null = null;
  private toastComponent: Toast | null = null;
  private sidebarComponent: Sidebar | null = null;
  private permissionSlot: PermissionDialogSlot | null = null;
  private sidebarFocused = false;
  private lastScrollAt = 0;
  private lastMessagesHeight = 0;
  private lastChatWidth = 0;
  private lastSidebarWidth = 0;
  private lastPermStartY = 0;
  private lastPermHeight = 0;

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

  /**
   * Define o Toast a ser renderizado entre activityLog e inputBar.
   * Passe null para ocultar.
   */
  setToast(toast: Toast | null): void {
    this.toastComponent = toast;
  }

  /**
   * Define o PermissionDialogSlot a ser renderizado entre toast e statusBar.
   * Passe null para remover.
   */
  setPermissionDialog(slot: PermissionDialogSlot | null): void {
    this.permissionSlot = slot;
  }

  /** Retorna true se o permission dialog está ativo (tem linhas renderizadas). */
  hasActivePermissionDialog(): boolean {
    return this.permissionSlot !== null && this.permissionSlot.lineCount() > 0;
  }

  /**
   * Define o Sidebar a ser renderizado à direita do chat.
   * Passe null para remover.
   */
  setSidebar(sidebar: Sidebar | null): void {
    this.sidebarComponent = sidebar;
  }

  /**
   * Retorna se o sidebar tem foco (para routing de input).
   */
  isSidebarFocused(): boolean {
    return this.sidebarFocused && this.sidebarComponent?.isVisible() === true;
  }

  /**
   * Alterna foco entre chat e sidebar.
   */
  toggleSidebarFocus(): void {
    if (!this.sidebarComponent?.isVisible()) return;
    this.sidebarFocused = !this.sidebarFocused;
  }

  render(width: number, height: number): string[] {
    // Calcular largura do sidebar
    const sidebarVisible = this.sidebarComponent?.isVisible() === true;
    const MIN_SIDEBAR_WIDTH = 28;
    const MIN_CHAT_WIDTH = 40;

    let chatWidth = width;
    let sidebarWidth = 0;

    if (sidebarVisible && width >= MIN_CHAT_WIDTH + MIN_SIDEBAR_WIDTH) {
      // ~30% para sidebar, mínimo MIN_SIDEBAR_WIDTH, máximo 40
      sidebarWidth = Math.min(40, Math.max(MIN_SIDEBAR_WIDTH, Math.floor(width * 0.3)));
      chatWidth = width - sidebarWidth;
    }

    this.lastChatWidth = chatWidth;
    this.lastSidebarWidth = sidebarWidth;

    // Renderizar chat com chatWidth
    const statusHeight = 1;
    const inputHeight = Math.max(this.inputBar.minHeight(), 2);
    const activityHeight = this.activityLog?.visibleLineCount() ?? 0;
    const toastHeight = this.toastComponent?.visibleLineCount() ?? 0;
    const permLines = this.permissionSlot ? this.permissionSlot.render(chatWidth) : [];
    const permHeight = permLines.length;
    const messagesHeight = Math.max(0, height - statusHeight - inputHeight - activityHeight - toastHeight - permHeight);
    this.lastMessagesHeight = messagesHeight;
    this.lastPermStartY = messagesHeight + activityHeight + toastHeight + 1;
    this.lastPermHeight = permHeight;

    const messageLines = this.messageList.render(chatWidth, messagesHeight);
    const activityLines = activityHeight > 0
      ? this.activityLog!.render(chatWidth, activityHeight)
      : [];
    const toastLines = toastHeight > 0
      ? this.toastComponent!.render(chatWidth, toastHeight)
      : [];
    const inputLines = this.inputBar.render(chatWidth, inputHeight);
    const statusLines = this.statusBar.render(chatWidth, statusHeight);

    const chatLines = [...messageLines, ...activityLines, ...toastLines, ...permLines, ...statusLines, ...inputLines];

    // Se sem sidebar, retornar chat direto
    if (sidebarWidth === 0 || !this.sidebarComponent) {
      return chatLines;
    }

    // Renderizar sidebar
    const sidebarLines = this.sidebarComponent.render(sidebarWidth, height);

    // Juntar horizontalmente: chatLine + sidebarLine
    const result: string[] = [];
    for (let i = 0; i < height; i++) {
      const chatLine = fitWidth(chatLines[i] ?? '', chatWidth);
      const sidebarLine = fitWidth(sidebarLines[i] ?? '', sidebarWidth);
      result.push(chatLine + sidebarLine);
    }

    return result;
  }

  /**
   * Despacha um clique de mouse para o componente correto com base na posição Y.
   * MessageList ocupa as linhas 1..lastMessagesHeight do layout.
   */
  handleMouse(event: MouseClickEvent): boolean {
    const sidebarVisible = this.sidebarComponent?.isVisible() === true;

    // Se sidebar visível e click no lado direito → rotear ao sidebar
    if (sidebarVisible && this.lastSidebarWidth > 0 && event.x > this.lastChatWidth) {
      this.sidebarFocused = true;
      const sidebarEvent: MouseClickEvent = {
        ...event,
        x: event.x - this.lastChatWidth,
      };
      return this.sidebarComponent!.handleMouse(sidebarEvent);
    }

    // Click no chat → tirar foco do sidebar
    if (sidebarVisible) {
      this.sidebarFocused = false;
    }

    // Routing normal do chat
    if (event.y >= 1 && event.y <= this.lastMessagesHeight) {
      return this.messageList.handleMouse?.(event) ?? false;
    }

    // Click na área do permission dialog → rotear para ele
    if (this.lastPermHeight > 0 && this.permissionSlot?.handleMouse) {
      if (event.y >= this.lastPermStartY && event.y < this.lastPermStartY + this.lastPermHeight) {
        const localEvent: MouseClickEvent = {
          ...event,
          y: event.y - this.lastPermStartY,
        };
        return this.permissionSlot.handleMouse(localEvent);
      }
    }

    return false;
  }

  /**
   * Despacha drag do mouse para o componente correto.
   * Drag na área de mensagens → MessageList.
   */
  handleMouseDrag(event: MouseDragEvent): boolean {
    // Se sidebar visível e drag no lado direito → consumir sem ação
    if (this.sidebarComponent?.isVisible() && this.lastSidebarWidth > 0 && event.x > this.lastChatWidth) {
      return true;
    }

    // Routing normal
    if (event.y >= 1 && event.y <= this.lastMessagesHeight) {
      return this.messageList.handleMouseDrag?.(event) ?? false;
    }
    return false;
  }

  handleKey(event: KeyEvent): boolean {
    const { key } = event;

    // Tab alterna foco entre chat e sidebar
    if (key === 'tab' && !event.shift && !event.ctrl && !event.meta) {
      if (this.sidebarComponent?.isVisible()) {
        this.toggleSidebarFocus();
        return true;
      }
    }

    // Se sidebar tem foco → delegar ao sidebar
    if (this.isSidebarFocused()) {
      return this.sidebarComponent!.handleKey(event);
    }

    // === Permission dialog tem prioridade quando ativo ===
    if (this.permissionSlot && this.permissionSlot.lineCount() > 0) {
      return this.permissionSlot.handleKey(event);
    }

    // === Bloquear Enter enquanto seleção de texto ativa (evitar envio acidental) ===
    if (key === 'return' && this.messageList.isSelectionActive()) {
      return true   // consume: não enviar ao InputBar
    }

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
    const toastHeight = this.toastComponent?.visibleLineCount() ?? 0;
    const permHeight = this.permissionSlot?.lineCount() ?? 0;
    return this.inputBar.minHeight() + this.statusBar.minHeight() + 3 + activityHeight + toastHeight + permHeight;
  }
}
