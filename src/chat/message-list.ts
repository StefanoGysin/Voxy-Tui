import type { Component, MouseClickEvent, MouseDragEvent } from '../core/component';
import type { ChatMessage } from './types';
import { RESET, BOLD, DIM, ITALIC } from '../core/ansi';
import { theme } from '../core/theme';
import { wrapText } from '../utils/wrap';
import { padEndAnsi, byteIndexAtVisualCol, measureWidth, fitWidth } from '../utils/width';
import { stripAnsi } from '../utils/strip-ansi';
import { renderMarkdown } from './markdown';
import { ThinkingBlock } from './thinking-block';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Seleção de texto — blue background (preserva cores originais fora da seleção)
const SEL_HL  = '\x1b[44m';  // blue background (standard, todos os terminais)
const SEL_RST = '\x1b[49m';  // reset background only (preserva foreground/bold/etc.)

// Scrollbar — usando theme TrueColor
const SCROLLBAR_SEP   = `${theme.scrollbarSepFg}│${RESET}`;
const SCROLLBAR_THUMB = `${theme.scrollbarThumbBg}${theme.scrollbarThumbFg}▐${RESET}`;
const SCROLLBAR_TRACK = `${theme.scrollbarTrackBg}${theme.scrollbarTrackFg}╎${RESET}`;
const SCROLLBAR_HINT_BORDER = `${theme.scrollbarSepFg}│${RESET}`;
const MARGIN_LEFT = 2;  // espaço de respiração à esquerda do conteúdo
const SCROLLBAR_PAGE_LINES = 10;

/** Retorna o caractere ANSI colorido de borda esquerda para a role dada. */
function getMsgBorderAnsi(role: ChatMessage['role']): string {
  switch (role) {
    case 'user':      return `${theme.successFg}│${RESET}`;
    case 'assistant': return `${theme.selectedFg}│${RESET}`;
    case 'system':    return `${theme.textDim}│${RESET}`;
    case 'tool':      return `${theme.warningFg}│${RESET}`;
    default:          return `${theme.textDim}│${RESET}`;
  }
}

/** Retorna a cor ANSI para o nome de uma tool. */
function getToolNameColor(name: string): string {
  switch (name) {
    case 'Read': case 'Glob': case 'Grep': return theme.selectedFg;
    case 'Edit': case 'Write': return theme.successFg;
    case 'Bash': return theme.warningFg;
    default: return theme.textDim;
  }
}

/** Extrai basename de um caminho de arquivo. */
function basename(filePath: string): string {
  // Suportar tanto / quanto \ como separador
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

/** Gera summary inteligente para uma tool message (1 linha). */
function generateToolSummary(msg: ChatMessage, maxWidth: number): string {
  const raw = msg.toolRawInput;
  const output = msg.toolOutput ?? [];
  const rawName = msg.toolName ?? '';
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  switch (name) {
    case 'Read': {
      const filePath = (raw?.file_path as string) ?? '';
      const base = filePath ? basename(filePath) : '';
      const lineCount = output.length;
      const summary = base
        ? `${base} · ${lineCount} linhas`
        : (msg.toolInput ?? '');
      return stripAnsi(fitWidth(summary, maxWidth));
    }

    case 'Glob': {
      const pattern = (raw?.pattern as string) ?? '';
      const count = output.length;
      const summary = pattern
        ? `${count} arquivos · ${pattern}`
        : `${count} arquivos`;
      return stripAnsi(fitWidth(summary, maxWidth));
    }

    case 'Grep': {
      const pattern = (raw?.pattern as string) ?? '';
      const count = output.length;
      const summary = pattern
        ? `${count} matches · "${pattern}"`
        : `${count} matches`;
      return stripAnsi(fitWidth(summary, maxWidth));
    }

    case 'Bash': {
      const command = (raw?.command as string) ?? msg.toolInput ?? '';
      return stripAnsi(fitWidth(command, maxWidth));
    }

    case 'Edit': {
      const filePath = (raw?.file_path as string) ?? '';
      const base = filePath ? basename(filePath) : '';
      const oldStr = (raw?.old_string as string) ?? '';
      const newStr = (raw?.new_string as string) ?? '';
      const oldLines = oldStr ? oldStr.split('\n').length : 0;
      const newLines = newStr ? newStr.split('\n').length : 0;
      const summary = base
        ? `${base} · −${oldLines} +${newLines}`
        : (msg.toolInput ?? '');
      return stripAnsi(fitWidth(summary, maxWidth));
    }

    case 'Write': {
      const filePath = (raw?.file_path as string) ?? '';
      const base = filePath ? basename(filePath) : '';
      const content = (raw?.content as string) ?? '';
      const lineCount = content ? content.split('\n').length : output.length;
      const outputJoined = output.join(' ').toLowerCase();
      const isUpdate = outputJoined.includes('has been updated');
      const action = isUpdate ? 'Sobrescreveu' : 'Criou';
      const summary = base
        ? `${action} ${base} · ${lineCount} linhas`
        : (msg.toolInput ?? '');
      return stripAnsi(fitWidth(summary, maxWidth));
    }

    default: {
      const fallback = msg.toolInput ?? '';
      return stripAnsi(fitWidth(fallback, maxWidth));
    }
  }
}

function renderToolMessage(msg: ChatMessage, width: number): string[] {
  const rawName = msg.toolName ?? 'Tool';
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);
  const output = msg.toolOutput ?? [];
  const status = msg.toolStatus ?? 'done';
  const collapsed = msg.toolCollapsed !== false;

  const icon = status === 'done'
    ? `${theme.successFg}✓${RESET}`
    : `${theme.dangerFg}✗${RESET}`;

  const nameColor = getToolNameColor(name);
  const nameAnsi = `${nameColor}${BOLD}${name}${RESET}`;

  const hintExpandText = 'Ctrl+E expandir';
  const hintCollapseText = 'Ctrl+E recolher';

  if (collapsed) {
    // 1-line collapsed: icon + name + summary ... hint
    const hintText = hintExpandText;
    const hintAnsi = `${theme.textMuted}${DIM}${hintText}${RESET}`;
    // Overhead: "✓ " (2) + name + "  " (2) + hint
    const nameWidth = measureWidth(name);
    const summaryMaxWidth = Math.max(1, width - 2 - nameWidth - 2 - hintText.length - 1);
    const summary = generateToolSummary(msg, summaryMaxWidth);
    const leftPart = `${icon} ${nameAnsi}  ${theme.textDim}${summary}${RESET}`;
    return [padEndAnsi(leftPart, width - hintText.length) + hintAnsi];
  }

  // Expanded view
  const hintText = hintCollapseText;
  const hintAnsi = `${theme.textMuted}${DIM}${hintText}${RESET}`;
  const nameWidth = measureWidth(name);
  const summaryMaxWidth = Math.max(1, width - 2 - nameWidth - 2 - hintText.length - 1);
  const summary = generateToolSummary(msg, summaryMaxWidth);
  const headerLeft = `${icon} ${nameAnsi}  ${theme.textDim}${summary}${RESET}`;
  const header = padEndAnsi(headerLeft, width - hintText.length) + hintAnsi;

  const lines: string[] = [header];

  // Input details
  const raw = msg.toolRawInput;
  if (raw) {
    for (const [key, value] of Object.entries(raw)) {
      const valStr = typeof value === 'string' ? value : JSON.stringify(value);
      // Sanitizar tabs para consistência de largura
      const cleanVal = valStr.replace(/\t/g, '  ');
      // Truncar valor longo em 1 linha
      const maxValWidth = Math.max(1, width - key.length - 4); // "  key: "
      const truncated = stripAnsi(fitWidth(cleanVal.split('\n')[0], maxValWidth));
      lines.push(fitWidth(`  ${theme.textDim}${key}: ${truncated}${RESET}`, width));
    }
  } else if (msg.toolInput) {
    const cleanInput = (msg.toolInput ?? '').replace(/\t/g, '  ');
    lines.push(fitWidth(`  ${theme.textDim}${cleanInput}${RESET}`, width));
  }

  // Separador fino entre input e output
  lines.push(`  ${theme.borderFg}${'─'.repeat(Math.max(0, width - 2))}${RESET}`);

  // Output completo
  if (output.length > 0) {
    const isEdit = name === 'Edit';
    const isWrite = name === 'Write';

    // Write com "+ " prefix precisa de 4 chars de overhead (2 indent + 2 prefix)
    // Demais precisam de 2 chars (indent)
    const maxLineWidth = isWrite
      ? Math.max(1, width - 4)
      : Math.max(1, width - 2);

    for (const outLine of output) {
      // Sanitizar tabs — string-width conta tab como 0 width,
      // mas terminal renderiza como 1-8 colunas visíveis
      const cleanLine = outLine.replace(/\t/g, '  ');
      const wrapped = wrapText(cleanLine, maxLineWidth);
      for (let wi = 0; wi < wrapped.length; wi++) {
        let renderedLine: string;
        if (wi === 0) {
          renderedLine = wrapped[wi];
        } else {
          renderedLine = `${theme.textDim}↳${RESET} ${wrapped[wi]}`;
        }

        // Colorir linhas de diff para Edit
        if (isEdit) {
          const stripped = stripAnsi(renderedLine);
          if (stripped.startsWith('-') || stripped.startsWith('< ')) {
            renderedLine = `${theme.diffDelFg}${stripped}${RESET}`;
          } else if (stripped.startsWith('+') || stripped.startsWith('> ')) {
            renderedLine = `${theme.diffAddFg}${stripped}${RESET}`;
          }
        }

        // Colorir linhas de conteúdo para Write (não metadata)
        if (isWrite) {
          const stripped = stripAnsi(renderedLine);
          // Linhas cat-n: espaços + dígitos + espaço (ex: "     1  content")
          // Metadata: "File created...", "The file ... has been updated..."
          const isCatNLine = /^\s*\d+\s/.test(stripped);
          if (isCatNLine) {
            renderedLine = `${theme.diffAddFg}+ ${stripped}${RESET}`;
          }
        }

        // Indentação de 2 espaços + fitWidth para garantir largura exata
        lines.push(fitWidth(`  ${renderedLine}`, width));
      }
    }
  }

  // SEM separador trailing — gerenciado por buildAllLines
  return lines;
}

function renderMessage(msg: ChatMessage, width: number, thinkingBlock?: ThinkingBlock): string[] {
  let header: string;
  const time = `${theme.textDim}${DIM}${formatTime(msg.timestamp)}${RESET}`;

  switch (msg.role) {
    case 'user':
      header = `${theme.successFg}${BOLD}⬥ You${RESET} ${time}`;
      break;
    case 'assistant':
      header = `${theme.selectedFg}${BOLD}✦ Assistant${RESET} ${time}`;
      break;
    case 'system':
      header = `${theme.textDim}${ITALIC}▸ System${RESET} ${time}`;
      break;
    case 'tool':
      return renderToolMessage(msg, width);
  }

  const thinkingLines = thinkingBlock ? thinkingBlock.render(width, 10000) : [];
  const contentLines = msg.role === 'assistant'
    ? renderMarkdown(msg.content, width)
    : wrapText(msg.content, width);
  const separator = `${theme.borderFg}${DIM}${'─'.repeat(width)}${RESET}`;
  return [header, ...thinkingLines, ...contentLines, separator];
}

interface BuildResult {
  lines: string[];
  borders: string[];
  thinkingMap: Map<number, ThinkingBlock>;
  msgMap: (ChatMessage | null)[];
  msgStartMap: Map<ChatMessage, number>;
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

  // ThinkingBlock instances (persiste collapsed state por mensagem)
  private thinkingBlocks = new Map<ChatMessage, ThinkingBlock>();

  // Mapa allLineIdx → ThinkingBlock, reconstruído em cada render()
  // Usado por handleMouse() para detectar clique no ThinkingBlock com coordenadas
  // consistentes com lastAllLinesCount (evita off-by-1 durante streaming)
  private thinkingLineMap = new Map<number, ThinkingBlock>();

  /** Callback chamado quando o usuário finaliza uma seleção. Recebe o texto selecionado. */
  onTextCopied?: (text: string) => void;

  /** Renderiza uma mensagem, passando o ThinkingBlock associado (se houver). */
  private renderMsg(msg: ChatMessage, width: number): string[] {
    let block: ThinkingBlock | undefined;
    if (msg.thinkingContent) {
      block = this.thinkingBlocks.get(msg);
      if (!block) {
        block = new ThinkingBlock();
        this.thinkingBlocks.set(msg, block);
      }
      block.setContent(msg.thinkingContent);
    }
    return renderMessage(msg, width, block);
  }

  /**
   * Constrói allLines com separadores corretos:
   * - Tool messages: SEM separador trailing
   * - Non-tool messages: COM separador trailing (incluído por renderMessage)
   * - Transição tool→non-tool: injeta 1 linha de separador ─
   */
  private buildAllLines(textWidth: number): BuildResult {
    const lines: string[] = [];
    const borders: string[] = [];
    const thinkingMap = new Map<number, ThinkingBlock>();
    const msgMap: (ChatMessage | null)[] = [];
    const msgStartMap = new Map<ChatMessage, number>();

    let prevWasTool = false;

    for (const msg of this.messages) {
      const isTool = msg.role === 'tool';

      // Transição tool→non-tool: injetar separador
      if (prevWasTool && !isTool) {
        const sep = `${theme.borderFg}${'─'.repeat(textWidth)}${RESET}`;
        lines.push(sep);
        borders.push(getMsgBorderAnsi('tool'));
        msgMap.push(null);
      }

      msgStartMap.set(msg, lines.length);
      const lineStart = lines.length;
      const msgLines = this.renderMsg(msg, textWidth);

      // Construir thinkingMap para mensagens assistant com thinking
      if (msg.thinkingContent) {
        const block = this.thinkingBlocks.get(msg);
        if (block) {
          const thinkingStart = lineStart + 1; // +1 pula header
          const thinkingLineCount = block.render(textWidth, 10000).length;
          for (let i = 0; i < thinkingLineCount; i++) {
            thinkingMap.set(thinkingStart + i, block);
          }
        }
      }

      const borderChar = getMsgBorderAnsi(msg.role);
      for (const line of msgLines) {
        lines.push(line);
        borders.push(borderChar);
        msgMap.push(msg);
      }

      prevWasTool = isTool;
    }

    return { lines, borders, thinkingMap, msgMap, msgStartMap };
  }

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
    rawInput?: Record<string, unknown>,
  ): void {
    const msg: ChatMessage = {
      id,
      role: 'tool',
      content: '',
      timestamp: new Date(),
      toolName: name,
      toolInput: input,
      toolOutput: output,
      toolStatus: status,
      toolCollapsed: true,
      toolRawInput: rawInput,
    };
    this.messages.push(msg);
    if (this.stickyBottom) {
      this.scrollOffset = 0;
    }
  }

  toggleLastTruncatedTool(): boolean {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === 'tool') {
        this.messages[i].toolCollapsed = !this.messages[i].toolCollapsed;
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

    const textWidth = width - 2 - MARGIN_LEFT
    const { lines: allLines } = this.buildAllLines(textWidth)
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

    // === LEFT PRESS — verificar ThinkingBlock ANTES de registrar âncora ===
    if (!event.isRelease) {
      // Toggle no PRESS: evita falha quando Windows Terminal / ConPTY envia drag events
      // espúrios entre press e release (faz code tratar como "drag real" → release ignorado).
      const totalP  = this.lastAllLinesCount;
      const heightP = this.lastRenderHeight;
      if (totalP > 0 && heightP > 0) {
        const idxP = this.screenYToAllLineIdx(event.y, totalP, heightP);
        if (idxP >= 0 && idxP < totalP) {
          const thinkingBlockP = this.thinkingLineMap.get(idxP);
          if (thinkingBlockP) {
            thinkingBlockP.toggle();
            return true;  // press consumido — não inicia seleção de texto
          }
        }
      }

      // Se há seleção ativa (highlight persistido), limpar e consumir — NÃO iniciar nova seleção
      if (this.selFinalized) {
        this.clearSelectionState()
        return true  // consome o evento, força re-render
      }

      // Seleção de texto: registrar âncora
      this.clearSelectionState();
      this.lastDragScreenY = event.y;
      const total  = this.lastAllLinesCount;
      const height = this.lastRenderHeight;
      if (total > 0 && height > 0) {
        const idx = this.screenYToAllLineIdx(event.y, total, height);
        this.selAnchorIdx = Math.max(0, Math.min(total - 1, idx));
        this.selAnchorX   = Math.max(0, event.x - 1 - MARGIN_LEFT);
      }
      return false;   // press não consome (seleção em andamento)
    }

    // === LEFT RELEASE com drag → manter highlight (sem copiar) ===
    if (this.isDragging && this.selAnchorIdx >= 0 && this.selCurrentIdx >= 0) {
      if (this.selAnchorIdx !== this.selCurrentIdx) {
        // Drag real — cursor moveu para outra linha → manter seleção
        this.isDragging      = false
        this.lastDragScreenY = -1
        this.selFinalized    = true
        return true
      }
      // Mesma linha — drag espúrio, tratar como clique simples
      this.isDragging = false
    }

    // === LEFT RELEASE sem drag → click (expand/collapse tool message) ===
    this.clearSelectionState()

    const width  = this.lastRenderWidth
    const height = this.lastRenderHeight
    if (height <= 0 || width <= 0) return false

    const textWidth = width - 2 - MARGIN_LEFT

    // Usar buildAllLines para mapeamento consistente
    const { msgMap, msgStartMap } = this.buildAllLines(textWidth)

    // Usar lastAllLinesCount (total do último render) — não msgMap.length.
    // Durante streaming, msgMap pode ter mais linhas que o último render,
    // causando padding errado em screenYToAllLineIdx e allLineIdx off-by-1.
    const renderTotal = this.lastAllLinesCount
    const allLineIdx = this.screenYToAllLineIdx(event.y, renderTotal, height)

    if (allLineIdx < 0 || allLineIdx >= renderTotal) return false
    const msg = msgMap[allLineIdx]
    if (!msg) return false

    // === Click em tool message → toggle collapsed ===
    if (msg.role !== 'tool') return false

    const wasCollapsed = msg.toolCollapsed !== false
    const oldLen = this.renderMsg(msg, textWidth).length

    msg.toolCollapsed = !msg.toolCollapsed

    const newLen = this.renderMsg(msg, textWidth).length
    const lineDelta = newLen - oldLen
    const totalAfter = msgMap.length + lineDelta
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
    this.thinkingBlocks.clear()
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
        bar.push(SCROLLBAR_THUMB);
      } else {
        bar.push(SCROLLBAR_TRACK);
      }
    }
    return bar;
  }

  render(width: number, height: number): string[] {
    if (height <= 0) return [];

    this.lastRenderWidth = width;
    this.lastRenderHeight = height;

    const textWidth = width - 2 - MARGIN_LEFT  // margem + 1 gap + 1 scrollbar

    // Renderizar todas as mensagens via buildAllLines
    const { lines: allLines, borders: allLineBorders, thinkingMap } = this.buildAllLines(textWidth);
    this.thinkingLineMap = thinkingMap;
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
      const hintLine = `${theme.textDim}${DIM}${prefix}${'─'.repeat(dashCount)}${RESET}`;
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
