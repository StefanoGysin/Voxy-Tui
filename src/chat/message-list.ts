import type { Component, MouseClickEvent, MouseDragEvent } from '../core/component';
import type { ChatMessage } from './types';
import { RESET, BOLD, DIM, ITALIC, FG_CYAN, FG_GREEN, FG_GRAY, FG_RED } from '../core/ansi';
import { wrapText } from '../utils/wrap';
import { padEndAnsi } from '../utils/width';
import { stripAnsi } from '../utils/strip-ansi';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const TOOL_COLLAPSED_OUTPUT_LINES = 3;

// Scrollbar
// Seleção de texto — highlight azul
const SEL_BG  = '\x1b[44;97m';  // fundo azul (ANSI 44) + texto branco brilhante (97)
const SEL_RST = '\x1b[0m';

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

  // Seleção por drag — estado em allLines-index space (não screen-space)
  private selAnchorIdx:     number  = -1;     // índice em allLines do âncora
  private selCurrentIdx:    number  = -1;     // índice em allLines do cursor atual
  private selFinalized:     boolean = false;  // true após copy; highlight persiste
  private isDragging:       boolean = false;
  private lastDragScreenY:  number  = -1;     // último screen-Y do drag (para scroll-extend)
  private lastAllLinesCount: number = 0;      // cacheado em render() — necessário para scroll-extend

  /** Callback chamado quando o usuário finaliza uma seleção. Recebe o texto selecionado. */
  onTextCopied?: (text: string) => void;

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
    return start + (screenY - 1);
  }

  /**
   * Finaliza a seleção por drag: extrai o texto, chama onTextCopied,
   * e seta selFinalized=true para manter o highlight visível após o release.
   * Os índices selAnchorIdx/selCurrentIdx NÃO são apagados aqui.
   */
  private finalizeSelection(): void {
    const width  = this.lastRenderWidth;
    const height = this.lastRenderHeight;

    // Limpar drag state mesmo que não consiga copiar
    this.isDragging      = false;
    this.lastDragScreenY = -1;

    if (height <= 0 || width <= 0 || this.selAnchorIdx < 0 || this.selCurrentIdx < 0) {
      return;
    }

    const contentWidth = width - 1;
    const allLines: string[] = [];
    for (const msg of this.messages) {
      allLines.push(...renderMessage(msg, contentWidth));
    }
    const total = allLines.length;

    const selStart = Math.max(0,         Math.min(this.selAnchorIdx, this.selCurrentIdx));
    const selEnd   = Math.min(total - 1, Math.max(this.selAnchorIdx, this.selCurrentIdx));

    if (selStart <= selEnd) {
      const text = allLines
        .slice(selStart, selEnd + 1)
        .map(l => stripAnsi(l).trimEnd())
        .join('\n');
      if (text.trim().length > 0) {
        this.onTextCopied?.(text);
      }
    }

    // MANTER selAnchorIdx/selCurrentIdx — highlight persiste até próximo press
    this.selFinalized = true;
  }

  /** Aplica fundo azul à linha se está no range de seleção [selStart, selEnd]. */
  private applySelHL(line: string, allLineIdx: number,
                     selStart: number, selEnd: number): string {
    if (selStart < 0 || allLineIdx < selStart || allLineIdx > selEnd) return line;
    return SEL_BG + stripAnsi(line) + SEL_RST;
  }

  /**
   * Trata clique e release do mouse na área do MessageList.
   *
   * - PRESS: limpa seleção anterior, registra âncora em allLines-index space.
   * - RELEASE sem drag: executa expand/collapse do tool message.
   * - RELEASE com drag: finaliza seleção, copia, mantém highlight.
   */
  handleMouse(event: MouseClickEvent): boolean {
    if (event.button !== 0) return false;

    // === PRESS — registrar âncora e limpar seleção anterior ===
    if (!event.isRelease) {
      // Novo press: apaga qualquer highlight persistente de seleção anterior
      this.selAnchorIdx  = -1;
      this.selCurrentIdx = -1;
      this.selFinalized  = false;
      this.isDragging    = false;
      this.lastDragScreenY = event.y;

      // Converter imediatamente para allLines-index space
      const total  = this.lastAllLinesCount;
      const height = this.lastRenderHeight;
      if (total > 0 && height > 0) {
        const idx = this.screenYToAllLineIdx(event.y, total, height);
        this.selAnchorIdx = Math.max(0, Math.min(total - 1, idx));
      }
      return false; // press não consome
    }

    // === RELEASE com drag → finalizar seleção ===
    if (this.isDragging && this.selAnchorIdx >= 0 && this.selCurrentIdx >= 0) {
      this.finalizeSelection();
      return true;
    }

    // === RELEASE sem drag → click (expand/collapse tool message) ===
    this.selAnchorIdx    = -1;
    this.selCurrentIdx   = -1;
    this.isDragging      = false;
    this.lastDragScreenY = -1;

    const width  = this.lastRenderWidth;
    const height = this.lastRenderHeight;
    if (height <= 0 || width <= 0) return false;

    const contentWidth = width - 1;

    // Construir mapeamento linha → mensagem
    const lineToMsg: (ChatMessage | null)[] = [];
    const msgStartMap = new Map<ChatMessage, number>();
    for (const msg of this.messages) {
      msgStartMap.set(msg, lineToMsg.length);
      const msgLines = renderMessage(msg, contentWidth);
      for (let i = 0; i < msgLines.length; i++) {
        lineToMsg.push(msg);
      }
    }

    const total = lineToMsg.length;
    const allLineIdx = this.screenYToAllLineIdx(event.y, total, height);

    if (allLineIdx < 0 || allLineIdx >= total) return false;
    const msg = lineToMsg[allLineIdx];
    if (!msg || msg.role !== 'tool') return false;
    if ((msg.toolOutput?.length ?? 0) <= TOOL_COLLAPSED_OUTPUT_LINES) return false;

    const wasCollapsed = msg.toolCollapsed !== false;
    const oldLen = renderMessage(msg, contentWidth).length;

    msg.toolCollapsed = !msg.toolCollapsed;

    const newLen = renderMessage(msg, contentWidth).length;
    const lineDelta = newLen - oldLen;
    const totalAfter = total + lineDelta;
    const msgStart = msgStartMap.get(msg) ?? 0;

    if (wasCollapsed) {
      let idealOffset = Math.max(0, totalAfter - msgStart - height);
      if (idealOffset > 0) idealOffset += 1;
      this.scrollOffset = Math.min(idealOffset, Math.max(0, totalAfter - height));
      this.stickyBottom = this.scrollOffset === 0;
    } else {
      const newScrollOffset = Math.max(0, this.scrollOffset + lineDelta);
      this.scrollOffset = newScrollOffset;
      this.stickyBottom = newScrollOffset === 0;
    }

    return true;
  }

  /**
   * Trata motion events com botão esquerdo pressionado (drag).
   * Converte screenY para allLines-index space e atualiza selCurrentIdx.
   */
  handleMouseDrag(event: MouseDragEvent): boolean {
    if (event.button !== 0) return false;

    // Drag sem press prévio (press veio de fora da área da MessageList)
    if (this.selAnchorIdx < 0) return false;

    const total  = this.lastAllLinesCount;
    const height = this.lastRenderHeight;
    if (total <= 0 || height <= 0) return false;

    const idx = Math.max(0, Math.min(total - 1,
      this.screenYToAllLineIdx(event.y, total, height),
    ));

    this.lastDragScreenY = event.y;
    this.selCurrentIdx   = idx;
    this.selFinalized    = false;

    if (!this.isDragging) {
      this.isDragging = true;
    }

    return true;
  }

  clear(): void {
    this.messages     = [];
    this.scrollOffset = 0;
    this.stickyBottom = true;
    // Limpar todo o estado de seleção
    this.selAnchorIdx    = -1;
    this.selCurrentIdx   = -1;
    this.selFinalized    = false;
    this.isDragging      = false;
    this.lastDragScreenY = -1;
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
    // Cachear count para uso em updateSelOnScroll() (scroll durante drag)
    this.lastAllLinesCount = allLines.length;

    const isScrollable = allLines.length > height;

    // Calcular range de seleção — agora usa índices diretos (sem conversão)
    let selStart = -1;
    let selEnd   = -1;
    if ((this.isDragging || this.selFinalized) && this.selAnchorIdx >= 0 && this.selCurrentIdx >= 0) {
      selStart = Math.min(this.selAnchorIdx, this.selCurrentIdx);
      selEnd   = Math.max(this.selAnchorIdx, this.selCurrentIdx);
      // Clamp ao range válido
      selStart = Math.max(0, selStart);
      selEnd   = Math.min(allLines.length - 1, selEnd);
    }

    // === Caso: conteúdo cabe na viewport (sem scrollbar) ===
    if (!isScrollable) {
      const padding = height - allLines.length;
      return [
        ...Array<string>(padding).fill(''),
        ...allLines.map((l, i) => padEndAnsi(this.applySelHL(l, i, selStart, selEnd), width)),
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
    return sliced.map((line, i) => {
      const allLineIdx = start + i;
      // Não aplicar highlight à linha de hint (scrollOffset > 0, i === 0 substitui conteúdo)
      const isHint = this.scrollOffset > 0 && i === 0;
      const hl = isHint ? line : this.applySelHL(line, allLineIdx, selStart, selEnd);
      return padEndAnsi(hl, contentWidth) + scrollbar[i];
    });
  }
}
