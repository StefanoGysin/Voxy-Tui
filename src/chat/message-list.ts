import type { Component, MouseClickEvent, MouseDragEvent } from '../core/component';
import type { ChatMessage } from './types';
import { RESET, BOLD, DIM, ITALIC, FG_CYAN, FG_GREEN, FG_GRAY, FG_RED, FG_YELLOW } from '../core/ansi';
import { wrapText } from '../utils/wrap';
import { padEndAnsi, byteIndexAtVisualCol, measureWidth } from '../utils/width';
import { stripAnsi } from '../utils/strip-ansi';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TOOL_COLLAPSED_OUTPUT_LINES = 3;

// Scrollbar
// Seleção de texto — blue background (preserva cores originais fora da seleção)
const SEL_HL  = '\x1b[44m';  // blue background (standard, todos os terminais)
const SEL_RST = '\x1b[49m';  // reset background only (preserva foreground/bold/etc.)

// Scrollbar — separador + background color
const SCROLLBAR_SEP   = '\x1b[38;5;236m│\x1b[0m';
const SCROLLBAR_THUMB = '\x1b[48;5;240m\x1b[38;5;248m▐\x1b[0m';
const SCROLLBAR_TRACK = '\x1b[48;5;234m\x1b[38;5;237m╎\x1b[0m';
const SCROLLBAR_HINT_BORDER = '\x1b[38;5;237m│\x1b[0m';
const MARGIN_LEFT = 2;  // espaço de respiração à esquerda do conteúdo
const SCROLLBAR_PAGE_LINES = 10;

/** Retorna o caractere ANSI colorido de borda esquerda para a role dada. */
function getMsgBorderAnsi(role: ChatMessage['role']): string {
  switch (role) {
    case 'user':      return `${FG_GREEN}│${RESET}`;
    case 'assistant': return `${FG_CYAN}│${RESET}`;
    case 'system':    return `${FG_GRAY}│${RESET}`;
    case 'tool':      return `${FG_YELLOW}│${RESET}`;
    default:          return `${FG_GRAY}│${RESET}`;
  }
}

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

  lines.push(`${FG_GRAY}${DIM}${'-'.repeat(width)}${RESET}`);
  return lines;
}

function renderMessage(msg: ChatMessage, width: number): string[] {
  let header: string;
  const time = `${FG_GRAY}${DIM}${formatTime(msg.timestamp)}${RESET}`;

  switch (msg.role) {
    case 'user':
      header = `${FG_GREEN}${BOLD}⬥ You${RESET} ${time}`;
      break;
    case 'assistant':
      header = `${FG_CYAN}${BOLD}✦ Assistant${RESET} ${time}`;
      break;
    case 'system':
      header = `${FG_GRAY}${ITALIC}▸ System${RESET} ${time}`;
      break;
    case 'tool':
      return renderToolMessage(msg, width);
  }

  const contentLines = wrapText(msg.content, width);
  const separator = `${FG_GRAY}${DIM}${'-'.repeat(width)}${RESET}`;
  return [header, ...contentLines, separator];
}

export class MessageList implements Component {
  private messages: ChatMessage[] = [];
  private scrollOffset = 0;
  private stickyBottom = true;
  private lastRenderWidth = 0;
  private lastRenderHeight = 0;

  // Seleção por drag — estado em allLines-index space (não screen-space)
  private selAnchorIdx:      number  = -1;     // índice em allLines do âncora
  private selAnchorX:        number  = 0;      // coluna visual (0-based) do âncora
  private selCurrentIdx:     number  = -1;     // índice em allLines do cursor atual
  private selCurrentX:       number  = 0;      // coluna visual (0-based) do cursor atual
  private selFinalized:      boolean = false;  // true após drag release; highlight persiste até right-click
  private isDragging:        boolean = false;
  private lastDragScreenY:   number  = -1;     // último screen-Y do drag (para scroll-extend)
  private lastAllLinesCount: number  = 0;      // cacheado em render() — necessário para scroll-extend

  // Scrollbar interaction state
  private isScrollable               = false;
  private lastScrollbarThumbPos      = 0;
  private lastScrollbarThumbSize     = 0;
  private isScrollbarDrag            = false;
  private scrollbarDragHandleOffset  = 0;

  /** Callback chamado quando o usuário finaliza uma seleção. Recebe o texto selecionado. */
  onTextCopied?: (text: string) => void;

  /**
   * Retorna true se há uma seleção ativa (durante drag ou após release com highlight).
   * Usado por ChatLayout.handleKey para bloquear Enter enquanto seleção visível.
   */
  isSelectionActive(): boolean {
    return (this.isDragging || this.selFinalized) &&
           this.selAnchorIdx >= 0 &&
           this.selCurrentIdx >= 0
  }

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
    this.updateSelOnScroll();
  }

  scrollDown(lines = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
    if (this.scrollOffset === 0) {
      this.stickyBottom = true;
    }
    this.updateSelOnScroll();
  }

  /**
   * Recomputa selCurrentIdx após mudança de scrollOffset enquanto arrasta.
   * Usa o último screen-Y do mouse (lastDragScreenY) com o novo scrollOffset.
   * Sem isso, rolar o viewport não estende a seleção.
   */
  private updateSelOnScroll(): void {
    if (!this.isDragging || this.lastDragScreenY < 0) return;
    const total  = this.lastAllLinesCount;
    const height = this.lastRenderHeight;
    if (total <= 0 || height <= 0) return;
    this.selCurrentIdx = Math.max(0, Math.min(total - 1,
      this.screenYToAllLineIdx(this.lastDragScreenY, total, height),
    ));
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
   * Converte uma coordenada Y de tela (1-based) para índice em allLines (0-based).
   * Retorna índice possivelmente fora de [0, total-1] — verificar no chamador.
   */
  private screenYToAllLineIdx(screenY: number, total: number, height: number): number {
    if (total <= height) {
      const padding = height - total;
      return (screenY - 1) - padding;
    }
    const maxOffset = Math.max(0, total - height);
    const clampedOffset = Math.min(this.scrollOffset, maxOffset);
    const end = total - clampedOffset;
    const start = end - height;
    const hintOffset = clampedOffset > 0 ? 1 : 0;
    return start + (screenY - 1) - hintOffset;
  }

  /**
   * Copia o texto selecionado (com precisão de coluna) via onTextCopied,
   * e limpa todo o estado de seleção.
   * Chamado pelo right-click release.
   */
  private copyAndClearSelection(): void {
    const width  = this.lastRenderWidth
    const height = this.lastRenderHeight
    if (height <= 0 || width <= 0 || this.selAnchorIdx < 0 || this.selCurrentIdx < 0) {
      this.clearSelectionState()
      return
    }

    const textWidth = width - 2 - MARGIN_LEFT  // margem + 1 gap + 1 scrollbar
    const allLines: string[] = []
    for (const msg of this.messages) {
      allLines.push(...renderMessage(msg, textWidth))
    }
    const total = allLines.length

    // Normalizar: garantir que from < to em allLines-index space
    const anchorFirst =
      this.selAnchorIdx < this.selCurrentIdx ||
      (this.selAnchorIdx === this.selCurrentIdx && this.selAnchorX <= this.selCurrentX)

    const fromIdx = anchorFirst ? this.selAnchorIdx  : this.selCurrentIdx
    const fromX   = anchorFirst ? this.selAnchorX    : this.selCurrentX
    const toIdx   = anchorFirst ? this.selCurrentIdx : this.selAnchorIdx
    const toX     = anchorFirst ? this.selCurrentX   : this.selAnchorX

    const selStart = Math.max(0,         fromIdx)
    const selEnd   = Math.min(total - 1, toIdx)

    if (selStart <= selEnd) {
      const stripped = allLines
        .slice(selStart, selEnd + 1)
        .map(l => stripAnsi(l).trimEnd())

      let text: string
      if (selStart === selEnd) {
        // Linha única
        const bStart = byteIndexAtVisualCol(stripped[0], fromX)
        const bEnd   = byteIndexAtVisualCol(stripped[0], toX + 1)
        text = stripped[0].slice(bStart, bEnd)
      } else {
        // Múltiplas linhas
        const firstLine = stripped[0]
        const lastLine  = stripped[stripped.length - 1]
        const bFirstStart = byteIndexAtVisualCol(firstLine, fromX)
        const bLastEnd    = byteIndexAtVisualCol(lastLine,  toX + 1)
        const parts: string[] = [
          firstLine.slice(bFirstStart),
          ...stripped.slice(1, stripped.length - 1),
          lastLine.slice(0, bLastEnd),
        ]
        text = parts.join('\n')
      }

      if (text.trim().length > 0) {
        this.onTextCopied?.(text)
      }
    }

    // Limpar toda a seleção
    this.clearSelectionState()
  }

  /** Limpa todo o estado de seleção. */
  private clearSelectionState(): void {
    this.selAnchorIdx  = -1
    this.selAnchorX    = 0
    this.selCurrentIdx = -1
    this.selCurrentX   = 0
    this.selFinalized  = false
    this.isDragging    = false
    this.lastDragScreenY = -1
  }

  /**
   * Aplica reverse video à parte selecionada da linha.
   *
   * - Linha fora do range → retorna sem modificação.
   * - Primeira linha da seleção → highlight de selFromX até o fim.
   * - Última linha da seleção → highlight do início até selToX (inclusive).
   * - Linha única (first === last) → highlight de selFromX até selToX.
   * - Linha do meio → highlight da linha inteira.
   *
   * Usa stripAnsi para evitar que códigos ANSI existentes interfiram com
   * as posições visuais. O texto fora da seleção mantém suas cores originais
   * (exceto na parte selecionada, que é stripada e envolvida em reverse video).
   */
  private applySelHL(
    line:       string,
    allLineIdx: number,
    selFromIdx: number, selFromX: number,
    selToIdx:   number, selToX:   number,
  ): string {
    if (selFromIdx < 0 || allLineIdx < selFromIdx || allLineIdx > selToIdx) return line

    const isFirst = allLineIdx === selFromIdx
    const isLast  = allLineIdx === selToIdx

    const xStart = isFirst ? selFromX : 0
    // xEnd: -1 significa "até o fim da linha"
    const xEnd   = isLast  ? selToX   : -1

    // Usar byteIndexAtVisualCol diretamente na linha original (com ANSI codes)
    // A função ignora sequências ANSI ao contar colunas visuais
    const bStart = byteIndexAtVisualCol(line, xStart)
    const bEnd   = xEnd < 0 ? line.length : byteIndexAtVisualCol(line, xEnd + 1)

    if (bStart >= bEnd) return line

    // Injetar background na linha original, preservando ANSI fora da seleção
    return (
      line.slice(0, bStart) +
      SEL_HL + line.slice(bStart, bEnd) + SEL_RST +
      line.slice(bEnd)
    )
  }

  /**
   * Trata clique e release do mouse na área do MessageList.
   *
   * - LEFT PRESS: limpa seleção anterior, registra âncora em allLines-index space.
   * - LEFT RELEASE com drag: mantém highlight (sem copiar).
   * - LEFT RELEASE sem drag: executa expand/collapse do tool message.
   * - RIGHT RELEASE com seleção ativa: copia texto + limpa seleção.
   */
  handleMouse(event: MouseClickEvent): boolean {
    // Limpar scrollbar drag em qualquer release
    if (event.isRelease && this.isScrollbarDrag) {
      this.isScrollbarDrag = false
      return true
    }

    // === SCROLLBAR COLUMN — interceptar ANTES de tudo ===
    if (this.isScrollable && event.x === this.lastRenderWidth) {
      if (!event.isRelease) {
        const screenY    = event.y - 1
        const thumbStart = this.lastScrollbarThumbPos
        const thumbEnd   = thumbStart + this.lastScrollbarThumbSize

        if (screenY >= thumbStart && screenY < thumbEnd) {
          this.isScrollbarDrag           = true
          this.scrollbarDragHandleOffset = screenY - thumbStart
        } else if (screenY < thumbStart) {
          this.scrollUp(SCROLLBAR_PAGE_LINES)
        } else {
          this.scrollDown(SCROLLBAR_PAGE_LINES)
        }
      } else {
        this.isScrollbarDrag = false
      }
      return true
    }

    // === RIGHT CLICK RELEASE → copiar seleção e limpar ===
    if (event.button === 2) {
      if (event.isRelease && this.isSelectionActive()) {
        this.copyAndClearSelection()
        return true
      }
      return false
    }

    // Ignorar tudo que não for botão esquerdo (button=0)
    if (event.button !== 0) return false

    // === LEFT PRESS — registrar âncora e limpar seleção anterior ===
    if (!event.isRelease) {
      this.clearSelectionState()
      this.lastDragScreenY = event.y

      // Converter para allLines-index space e registrar âncora com coluna X
      const total  = this.lastAllLinesCount
      const height = this.lastRenderHeight
      if (total > 0 && height > 0) {
        const idx = this.screenYToAllLineIdx(event.y, total, height)
        this.selAnchorIdx = Math.max(0, Math.min(total - 1, idx))
        this.selAnchorX   = Math.max(0, event.x - 1 - MARGIN_LEFT)  // converter 1-based → 0-based, descontar margem
      }
      return false   // press não consome
    }

    // === LEFT RELEASE com drag → manter highlight (sem copiar) ===
    if (this.isDragging && this.selAnchorIdx >= 0 && this.selCurrentIdx >= 0) {
      this.isDragging      = false
      this.lastDragScreenY = -1
      this.selFinalized    = true
      return true
    }

    // === LEFT RELEASE sem drag → click (expand/collapse tool message) ===
    this.clearSelectionState()

    const width  = this.lastRenderWidth
    const height = this.lastRenderHeight
    if (height <= 0 || width <= 0) return false

    const textWidth = width - 2 - MARGIN_LEFT  // margem + 1 gap + 1 scrollbar

    // Construir mapeamento linha → mensagem
    const lineToMsg: (ChatMessage | null)[] = []
    const msgStartMap = new Map<ChatMessage, number>()
    for (const msg of this.messages) {
      msgStartMap.set(msg, lineToMsg.length)
      const msgLines = renderMessage(msg, textWidth)
      for (let i = 0; i < msgLines.length; i++) {
        lineToMsg.push(msg)
      }
    }

    const total = lineToMsg.length
    const allLineIdx = this.screenYToAllLineIdx(event.y, total, height)

    if (allLineIdx < 0 || allLineIdx >= total) return false
    const msg = lineToMsg[allLineIdx]
    if (!msg || msg.role !== 'tool') return false
    if ((msg.toolOutput?.length ?? 0) <= TOOL_COLLAPSED_OUTPUT_LINES) return false

    const wasCollapsed = msg.toolCollapsed !== false
    const oldLen = renderMessage(msg, textWidth).length

    msg.toolCollapsed = !msg.toolCollapsed

    const newLen = renderMessage(msg, textWidth).length
    const lineDelta = newLen - oldLen
    const totalAfter = total + lineDelta
    const msgStart = msgStartMap.get(msg) ?? 0

    if (wasCollapsed) {
      let idealOffset = Math.max(0, totalAfter - msgStart - height)
      if (idealOffset > 0) idealOffset += 1
      this.scrollOffset = Math.min(idealOffset, Math.max(0, totalAfter - height))
      this.stickyBottom = this.scrollOffset === 0
    } else {
      const newScrollOffset = Math.max(0, this.scrollOffset + lineDelta)
      this.scrollOffset = newScrollOffset
      this.stickyBottom = newScrollOffset === 0
    }

    return true
  }

  /**
   * Trata motion events com botão esquerdo pressionado (drag).
   * Converte screenY para allLines-index space e atualiza selCurrentIdx.
   */
  handleMouseDrag(event: MouseDragEvent): boolean {
    // === SCROLLBAR DRAG ===
    if (this.isScrollbarDrag) {
      const height       = this.lastRenderHeight
      const thumbSize    = this.lastScrollbarThumbSize
      const trackRange   = height - thumbSize
      const maxOffset    = Math.max(0, this.lastAllLinesCount - height)

      if (trackRange > 0 && maxOffset > 0) {
        const newThumbTop = (event.y - 1) - this.scrollbarDragHandleOffset
        const clamped     = Math.max(0, Math.min(trackRange, newThumbTop))
        this.scrollOffset = Math.round(maxOffset * (1 - clamped / trackRange))
        this.scrollOffset = Math.max(0, Math.min(maxOffset, this.scrollOffset))
        this.stickyBottom = this.scrollOffset === 0
      }
      return true
    }

    if (event.button !== 0) return false;

    // Drag sem press prévio (press veio de fora da área da MessageList)
    if (this.selAnchorIdx < 0) return false;

    const total  = this.lastAllLinesCount;
    const height = this.lastRenderHeight;
    if (total <= 0 || height <= 0) return false;

    const idx = Math.max(0, Math.min(total - 1,
      this.screenYToAllLineIdx(event.y, total, height),
    ));

    this.lastDragScreenY = event.y
    this.selCurrentIdx   = idx
    this.selCurrentX     = Math.max(0, event.x - 1 - MARGIN_LEFT)  // converter 1-based → 0-based, descontar margem
    this.selFinalized    = false

    if (!this.isDragging) {
      this.isDragging = true;
    }

    return true;
  }

  clear(): void {
    this.messages     = []
    this.scrollOffset = 0
    this.stickyBottom = true
    this.clearSelectionState()
  }

  private renderScrollbar(height: number, totalLines: number, maxOffset: number): string[] {
    const thumbSize = Math.max(1, Math.round((height * height) / totalLines));
    const thumbPos = maxOffset === 0
      ? height - thumbSize
      : Math.round(((maxOffset - this.scrollOffset) / maxOffset) * (height - thumbSize));

    this.lastScrollbarThumbPos  = thumbPos;
    this.lastScrollbarThumbSize = thumbSize;

    const bar: string[] = [];
    for (let i = 0; i < height; i++) {
      if (i >= thumbPos && i < thumbPos + thumbSize) {
        bar.push(`\x1b[38;5;102m${SCROLLBAR_THUMB}${RESET}`);
      } else {
        bar.push(`\x1b[38;5;238m${SCROLLBAR_TRACK}${RESET}`);
      }
    }
    return bar;
  }

  render(width: number, height: number): string[] {
    if (height <= 0) return [];

    this.lastRenderWidth = width;
    this.lastRenderHeight = height;

    const textWidth = width - 2 - MARGIN_LEFT  // margem + 1 gap + 1 scrollbar

    // Renderizar todas as mensagens com textWidth
    const allLines: string[] = [];
    const allLineBorders: string[] = [];
    for (const msg of this.messages) {
      const msgLines = renderMessage(msg, textWidth);
      const borderChar = getMsgBorderAnsi(msg.role);
      for (const line of msgLines) {
        allLines.push(line);
        allLineBorders.push(borderChar);
      }
    }
    // Cachear count para uso em updateSelOnScroll() (scroll durante drag)
    this.lastAllLinesCount = allLines.length;

    const isScrollable = allLines.length > height;
    this.isScrollable = isScrollable;

    // Normalizar seleção: garantir selFrom < selTo em allLines-index space
    let selFromIdx = -1, selFromX = 0, selToIdx = -1, selToX = 0
    if ((this.isDragging || this.selFinalized) && this.selAnchorIdx >= 0 && this.selCurrentIdx >= 0) {
      const anchorFirst =
        this.selAnchorIdx < this.selCurrentIdx ||
        (this.selAnchorIdx === this.selCurrentIdx && this.selAnchorX <= this.selCurrentX)

      if (anchorFirst) {
        selFromIdx = this.selAnchorIdx;  selFromX = this.selAnchorX
        selToIdx   = this.selCurrentIdx; selToX   = this.selCurrentX
      } else {
        selFromIdx = this.selCurrentIdx; selFromX = this.selCurrentX
        selToIdx   = this.selAnchorIdx;  selToX   = this.selAnchorX
      }

      // Clamp ao range válido
      selFromIdx = Math.max(0,                   selFromIdx)
      selToIdx   = Math.min(allLines.length - 1, selToIdx)
    }

    // === Caso: conteúdo cabe na viewport (sem scrollbar) ===
    if (!isScrollable) {
      const padding = height - allLines.length;
      return [
        ...Array<string>(padding).fill(''),
        ...allLines.map((l, i) => {
          const hl = this.applySelHL(l, i, selFromIdx, selFromX, selToIdx, selToX)
          const border = allLineBorders[i] ?? ' '
          return padEndAnsi(border + ' ' + hl, width)
        }),
      ];
    }

    // === Caso: overflow — mostrar scrollbar ===
    const maxOffset = Math.max(0, allLines.length - height);
    if (this.scrollOffset > maxOffset) {
      this.scrollOffset = maxOffset;
    }

    const end = allLines.length - this.scrollOffset;
    const start = end - height;

    const scrollbar = this.renderScrollbar(height, allLines.length, maxOffset);

    if (this.scrollOffset > 0) {
      const prefix = `▴ ${this.scrollOffset} linhas acima `;
      const prefixWidth = measureWidth(prefix);
      const dashCount = Math.max(0, textWidth - prefixWidth - 1);
      const hintLine = `${FG_GRAY}${DIM}${prefix}${'-'.repeat(dashCount)}${RESET}`;
      const hintRow = SCROLLBAR_HINT_BORDER + ' ' + padEndAnsi(hintLine, textWidth) + SCROLLBAR_SEP + scrollbar[0];

      const contentSlice = allLines.slice(start, start + height - 1);
      const contentRows = contentSlice.map((line, i) => {
        const allLineIdx = start + i;
        const hl = this.applySelHL(line, allLineIdx, selFromIdx, selFromX, selToIdx, selToX);
        const border = allLineBorders[allLineIdx] ?? ' ';
        return border + ' ' + padEndAnsi(hl, textWidth) + SCROLLBAR_SEP + scrollbar[i + 1];
      });

      return [hintRow, ...contentRows];
    }

    const sliced = allLines.slice(start, end);
    return sliced.map((line, i) => {
      const allLineIdx = start + i;
      const hl = this.applySelHL(line, allLineIdx, selFromIdx, selFromX, selToIdx, selToX);
      const border = allLineBorders[allLineIdx] ?? ' ';
      return border + ' ' + padEndAnsi(hl, textWidth) + SCROLLBAR_SEP + scrollbar[i];
    });
  }
}
