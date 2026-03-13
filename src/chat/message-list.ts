import type { Component, MouseClickEvent } from '../core/component';
import type { ChatMessage } from './types';
import { RESET, BOLD, DIM, ITALIC, FG_CYAN, FG_GREEN, FG_GRAY, FG_RED } from '../core/ansi';
import { wrapText } from '../utils/wrap';
import { padEndAnsi } from '../utils/width';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TOOL_COLLAPSED_OUTPUT_LINES = 3;

// Scrollbar
const SCROLLBAR_THUMB = '█';
const SCROLLBAR_TRACK = '░';

function renderToolMessage(msg: ChatMessage, width: number): string[] {
  const name = msg.toolName ?? 'Tool';
  const input = msg.toolInput ?? '';
  const output = msg.toolOutput ?? [];
  const status = msg.toolStatus ?? 'done';
  const isTruncated = output.length > TOOL_COLLAPSED_OUTPUT_LINES;
  const collapsed = msg.toolCollapsed !== false;

  const icon = status === 'done'
    ? `${FG_GREEN}✓${RESET}`
    : `${FG_RED}✗${RESET}`;

  const HINT_EXPAND = `${FG_GRAY}${DIM}click expandir${RESET}`;
  const HINT_COLLPS = `${FG_GRAY}${DIM}click recolher${RESET}`;
  const hintText = isTruncated
    ? (collapsed ? 'click expandir' : 'click recolher')
    : '';
  const hintAnsi = isTruncated
    ? (collapsed ? HINT_EXPAND : HINT_COLLPS)
    : '';

  const headerLeft = `${icon} ${FG_CYAN}${BOLD}${name}${RESET}`;
  const header = hintText
    ? padEndAnsi(headerLeft, width - hintText.length) + hintAnsi
    : headerLeft;

  const lines: string[] = [header];

  if (input) {
    lines.push(`  ${FG_GRAY}${DIM}${input}${RESET}`);
  }

  if (output.length > 0) {
    const visibleOutput = (isTruncated && collapsed)
      ? output.slice(0, TOOL_COLLAPSED_OUTPUT_LINES)
      : output;

    lines.push(`${FG_GRAY}└${RESET} ${visibleOutput[0]}`);
    for (let i = 1; i < visibleOutput.length; i++) {
      lines.push(`  ${visibleOutput[i]}`);
    }

    if (isTruncated && collapsed) {
      const hidden = output.length - TOOL_COLLAPSED_OUTPUT_LINES;
      lines.push(`  ${FG_GRAY}${DIM}··· +${hidden} linhas ocultas${RESET}`);
    }
  }

  lines.push('');
  return lines;
}

function renderMessage(msg: ChatMessage, width: number): string[] {
  let header: string;
  const time = `${FG_GRAY}${DIM}${formatTime(msg.timestamp)}${RESET}`;

  switch (msg.role) {
    case 'user':
      header = `${FG_GREEN}${BOLD}● You${RESET} ${time}`;
      break;
    case 'assistant':
      header = `${FG_CYAN}${BOLD}◆ Assistant${RESET} ${time}`;
      break;
    case 'system':
      header = `${FG_GRAY}${ITALIC}◇ System${RESET} ${time}`;
      break;
    case 'tool':
      return renderToolMessage(msg, width);
  }

  const contentLines = wrapText(msg.content, width);
  return [header, ...contentLines, ''];
}

export class MessageList implements Component {
  private messages: ChatMessage[] = [];
  private scrollOffset = 0;
  private stickyBottom = true;
  private lastRenderWidth = 0;
  private lastRenderHeight = 0;

  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    if (this.stickyBottom) {
      this.scrollOffset = 0;
    }
  }

  updateLastMessage(content: string): void {
    if (this.messages.length === 0) return;
    this.messages[this.messages.length - 1].content = content;
    if (this.stickyBottom) {
      this.scrollOffset = 0;
    }
  }

  scrollUp(lines = 1): void {
    this.scrollOffset += lines;
    this.stickyBottom = false;
  }

  scrollDown(lines = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
    if (this.scrollOffset === 0) {
      this.stickyBottom = true;
    }
  }

  scrollToBottom(): void {
    this.scrollOffset = 0;
    this.stickyBottom = true;
  }

  /** Retorna o offset de scroll atual (0 = no fundo). Útil para testes. */
  getScrollOffset(): number {
    return this.scrollOffset;
  }

  addToolMessage(
    id: string,
    name: string,
    input: string,
    output: string[],
    status: 'done' | 'error',
  ): void {
    const collapsed = output.length > TOOL_COLLAPSED_OUTPUT_LINES;
    const msg: ChatMessage = {
      id,
      role: 'tool',
      content: '',
      timestamp: new Date(),
      toolName: name,
      toolInput: input,
      toolOutput: output,
      toolStatus: status,
      toolCollapsed: collapsed,
    };
    this.messages.push(msg);
    if (this.stickyBottom) {
      this.scrollOffset = 0;
    }
  }

  toggleLastTruncatedTool(): boolean {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (
        msg.role === 'tool' &&
        msg.toolOutput !== undefined &&
        msg.toolOutput.length > TOOL_COLLAPSED_OUTPUT_LINES
      ) {
        msg.toolCollapsed = !msg.toolCollapsed;
        return true;
      }
    }
    return false;
  }

  /**
   * Trata um clique de mouse na área do MessageList.
   * Clique esquerdo (press) numa linha de tool message truncada → toggle collapsed.
   * Retorna true se o evento foi consumido.
   */
  handleMouse(event: MouseClickEvent): boolean {
    // Apenas press do botão esquerdo
    if (event.isRelease || event.button !== 0) return false;

    const width = this.lastRenderWidth;
    const height = this.lastRenderHeight;
    if (height <= 0 || width <= 0) return false;

    // Reconstruir mapeamento linha → mensagem
    const contentWidth = width - 1;
    const lineToMsg: (ChatMessage | null)[] = [];
    for (const msg of this.messages) {
      const msgLines = renderMessage(msg, contentWidth);
      for (let i = 0; i < msgLines.length; i++) {
        lineToMsg.push(msg);
      }
    }

    const total = lineToMsg.length;
    // Converter event.y (1-based) para índice 0-based em allLines
    let allLineIdx: number;

    if (total <= height) {
      // Sem overflow: padding no topo
      const padding = height - total;
      allLineIdx = (event.y - 1) - padding;
    } else {
      // Com overflow: janela deslizante
      const maxOffset = total - height;
      const clampedOffset = Math.min(this.scrollOffset, maxOffset);
      const end = total - clampedOffset;
      const start = end - height;
      allLineIdx = start + (event.y - 1);
    }

    if (allLineIdx < 0 || allLineIdx >= total) return false;
    const msg = lineToMsg[allLineIdx];
    if (!msg || msg.role !== 'tool') return false;
    if ((msg.toolOutput?.length ?? 0) <= TOOL_COLLAPSED_OUTPUT_LINES) return false;

    msg.toolCollapsed = !msg.toolCollapsed;
    return true;
  }

  clear(): void {
    this.messages = [];
    this.scrollOffset = 0;
    this.stickyBottom = true;
  }

  /**
   * Gera o array de caracteres do scrollbar (1 char por linha da viewport).
   * thumb = posição atual, track = espaço restante.
   */
  private renderScrollbar(height: number, totalLines: number, maxOffset: number): string[] {
    const thumbSize = Math.max(1, Math.round((height * height) / totalLines));
    const thumbPos = maxOffset === 0
      ? height - thumbSize
      : Math.round(((maxOffset - this.scrollOffset) / maxOffset) * (height - thumbSize));

    const bar: string[] = [];
    for (let i = 0; i < height; i++) {
      if (i >= thumbPos && i < thumbPos + thumbSize) {
        bar.push(`${FG_GRAY}${SCROLLBAR_THUMB}${RESET}`);
      } else {
        bar.push(`${FG_GRAY}${DIM}${SCROLLBAR_TRACK}${RESET}`);
      }
    }
    return bar;
  }

  render(width: number, height: number): string[] {
    if (height <= 0) return [];

    this.lastRenderWidth = width;
    this.lastRenderHeight = height;

    const contentWidth = width - 1;

    // Renderizar todas as mensagens com contentWidth
    const allLines: string[] = [];
    for (const msg of this.messages) {
      allLines.push(...renderMessage(msg, contentWidth));
    }

    const isScrollable = allLines.length > height;

    // === Caso: conteúdo cabe na viewport (sem scrollbar) ===
    if (!isScrollable) {
      const padding = height - allLines.length;
      return [
        ...Array<string>(padding).fill(''),
        ...allLines.map(l => padEndAnsi(l, width)),
      ];
    }

    // === Caso: overflow — mostrar scrollbar ===

    // Clamp scrollOffset
    const maxOffset = Math.max(0, allLines.length - height);
    if (this.scrollOffset > maxOffset) {
      this.scrollOffset = maxOffset;
    }

    const end = allLines.length - this.scrollOffset;
    const start = end - height;
    const sliced = allLines.slice(start, end);

    // Indicador de scroll: substitui a primeira linha quando há conteúdo acima
    if (this.scrollOffset > 0) {
      const hintText = `↑ ${this.scrollOffset} linhas acima · PgUp/PgDn · roda do mouse`;
      sliced[0] = `${FG_GRAY}${DIM}${hintText}${RESET}`;
    }

    // Gerar scrollbar
    const scrollbar = this.renderScrollbar(height, allLines.length, maxOffset);

    // Combinar: conteúdo (padded ao contentWidth) + 1 char de scrollbar
    return sliced.map((line, i) => padEndAnsi(line, contentWidth) + scrollbar[i]);
  }
}
