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
const MARGIN_LEFT = 2;  // espaço de respiração à esquerda do conteúdo
const SCROLLBAR_PAGE_LINES = 10;

// Breakpoints pro Task tool HUD. Alinhados conceitualmente com
// chat-layout.ts:NARROW_THRESHOLD=80 (mínimo clássico de terminal)
// mas declarados local pra evitar coupling cross-file.
const TASK_HUD_FULL_MIN_WIDTH = 80;
const TASK_HUD_REDUCED_MIN_WIDTH = 60;
const TASK_HUD_MINIMAL_MIN_WIDTH = 40;

// TaskOutput HUD: trunca resultados longos pra evitar explodir a viewport.
// Valor mais generoso que o Task tool (que mostra prompt inteiro) porque
// resultados de agents tendem a ser longos. Conteúdo completo fica no sidebar.
const MAX_TASK_OUTPUT_RESULT_LINES = 10;
const MAX_TASK_OUTPUT_TURNS_LINES = 5;

/** Retorna o caractere ANSI colorido de borda esquerda para a role dada. */
function getMsgBorderAnsi(role: ChatMessage['role']): string {
  switch (role) {
    case 'user':      return `${theme.userTextFg}│${RESET}`;
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

/** Aplica background ANSI com anti-bleed: re-insere bg após cada RESET. */
function applyLineBg(line: string, bg: string | null): string {
  if (!bg) return line;
  return `${bg}${line.replaceAll(RESET, RESET + bg)}${RESET}`;
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
  // toolInput pode conter ANSI — sanitizar uma vez para usar como fallback
  const inputFallback = stripAnsi(msg.toolInput ?? '');

  switch (name) {
    case 'Read': {
      const filePath = (raw?.file_path as string) ?? '';
      const base = filePath ? basename(filePath) : '';
      const lineCount = output.length;
      const summary = base
        ? `${base} · ${lineCount} linhas`
        : inputFallback;
      return fitWidth(summary, maxWidth);
    }

    case 'Glob': {
      const pattern = (raw?.pattern as string) ?? '';
      const count = output.length;
      const summary = pattern
        ? `${count} arquivos · ${pattern}`
        : `${count} arquivos`;
      return fitWidth(summary, maxWidth);
    }

    case 'Grep': {
      const pattern = (raw?.pattern as string) ?? '';
      const count = output.length;
      const summary = pattern
        ? `${count} matches · "${pattern}"`
        : `${count} matches`;
      return fitWidth(summary, maxWidth);
    }

    case 'Bash': {
      const command = stripAnsi((raw?.command as string) ?? msg.toolInput ?? '');
      return fitWidth(command, maxWidth);
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
        : inputFallback;
      return fitWidth(summary, maxWidth);
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
        : inputFallback;
      return fitWidth(summary, maxWidth);
    }

    default: {
      return fitWidth(inputFallback, maxWidth);
    }
  }
}

// ============================================================================
// Task tool HUD — visual dedicado pra sub-agents (Explore/Plan/general-purpose)
// ============================================================================

interface TaskParams {
  agentType: string;
  description: string;
  prompt: string;
  isAsync: boolean;
  model: string | null;
  status: 'done' | 'error';
}

function extractTaskParams(msg: ChatMessage): TaskParams {
  const raw = msg.toolRawInput ?? {};
  const description = typeof raw.description === 'string' ? raw.description : (msg.toolInput ?? '');
  const prompt = typeof raw.prompt === 'string' ? raw.prompt : '';
  const subagent = typeof raw.subagent_type === 'string' ? raw.subagent_type : 'general-purpose';
  const agentType = subagent.charAt(0).toUpperCase() + subagent.slice(1);
  const isAsync = raw.run_in_background === true;
  const model = typeof raw.model_name === 'string' ? raw.model_name : null;
  const status = msg.toolStatus ?? 'done';
  return { agentType, description, prompt, isAsync, model, status };
}

function buildBadge(label: string, fgColor: string, bgColor: string): string {
  return `${bgColor}${fgColor}${BOLD} ${label.toUpperCase()} ${RESET}`;
}

function statusIcon(status: 'done' | 'error'): string {
  return status === 'done'
    ? `${theme.successFg}✓${RESET}`
    : `${theme.dangerFg}✗${RESET}`;
}

function accentBar(): string {
  return `${theme.agentAccentFg}${BOLD}┃${RESET}`;
}

// ----------------------------------------------------------------------------
// HUD building blocks compartilhados (Task + TaskOutput)
// ----------------------------------------------------------------------------

/** Borda superior de box com label embutido: ┌─ LABEL ─...─┐ (largura = boxWidth). */
function boxTopBorder(label: string, boxWidth: number): string {
  const innerDashes = Math.max(0, boxWidth - 2 - label.length - 1);
  return `┌─${label}${'─'.repeat(innerDashes)}┐`;
}

/** Borda inferior de box: └─...─┘ (largura = boxWidth). */
function boxBottomBorder(boxWidth: number): string {
  return `└${'─'.repeat(boxWidth - 2)}┘`;
}

/**
 * Linha interna de box: │ <conteúdo padded até contentWidth> │.
 * fitWidth garante padding e truncamento exatos para alinhar a borda direita.
 */
function boxContentLine(content: string, contentFg: string, contentWidth: number): string {
  const fitted = fitWidth(content, contentWidth);
  return `${theme.textDim}│${RESET}${theme.agentPromptBoxBg} ${contentFg}${fitted}${RESET}${theme.agentPromptBoxBg} ${theme.textDim}│${RESET}`;
}

/**
 * Adiciona o footer padrão do HUD expandido ("visible in sidebar · Tasks" ...
 * "Ctrl+E recolher"), opcionalmente precedido pela linha tracejada ┄ do card full.
 */
function pushHudFooter(
  lines: string[],
  bgs: (string | null)[],
  bar: string,
  width: number,
  opts: { dashed: boolean; bg: string },
): void {
  if (opts.dashed) {
    const dashWidth = Math.max(0, width - 2);
    lines.push(`${bar} ${theme.textMuted}${DIM}${'┄'.repeat(dashWidth)}${RESET}`);
    bgs.push(theme.agentCardFooterBg);
  }
  const hintText = 'Ctrl+E recolher';
  const sidebarText = 'visible in sidebar · Tasks';
  const sidebarAnsi = `${theme.textMuted}${DIM}${sidebarText}${RESET}`;
  const hintAnsi = `${theme.textMuted}${DIM}${hintText}${RESET}`;
  const footerOverhead = 1 + 1 + sidebarText.length + 1 + hintText.length + 1;
  const footerGap = Math.max(1, width - footerOverhead);
  lines.push(`${bar} ${sidebarAnsi}${' '.repeat(footerGap)}${hintAnsi} `);
  bgs.push(opts.bg);
}

function renderTaskCollapsed(msg: ChatMessage, width: number): { lines: string[]; bgs: (string | null)[] } {
  const p = extractTaskParams(msg);
  const icon = statusIcon(p.status);
  const hintText = 'Ctrl+E expandir';
  const hintAnsi = `${theme.textMuted}${DIM}${hintText}${RESET}`;
  const agentMark = `${theme.agentAccentFg}✦${RESET} ${theme.agentAccentFg}${BOLD}${p.agentType}${RESET}`;
  const agentVisual = measureWidth(`✦ ${p.agentType}`);

  const showBadge = width >= TASK_HUD_REDUCED_MIN_WIDTH && p.isAsync;
  const badgeStr = showBadge ? buildBadge('ASYNC', theme.badgeAsyncFg, theme.badgeAsyncBg) : '';
  const badgeVisual = showBadge ? measureWidth(' ASYNC ') : 0;

  // overhead: icon(1) + ' '(1) + agentVisual + ' '(1) + [badge + ' '(1)] + ' '(1) + hint + slack
  const overhead = 1 + 1 + agentVisual + 1 + (showBadge ? badgeVisual + 1 : 0) + 1 + hintText.length + 1;
  const descMax = Math.max(1, width - overhead);
  const descTruncated = fitWidth(p.description, descMax);

  const leftBadgePart = showBadge ? ` ${badgeStr}` : '';
  const leftPart = `${icon} ${agentMark}${leftBadgePart} ${theme.textDim}${descTruncated}${RESET}`;
  const line = padEndAnsi(leftPart, width - hintText.length) + hintAnsi;
  return { lines: [line], bgs: [theme.toolMsgBg] };
}

function renderTaskHudFull(msg: ChatMessage, width: number): { lines: string[]; bgs: (string | null)[] } {
  const p = extractTaskParams(msg);
  const icon = statusIcon(p.status);
  const lines: string[] = [];
  const bgs: (string | null)[] = [];
  const bar = accentBar();

  // Build badges
  const asyncBadge = p.isAsync ? buildBadge('ASYNC', theme.badgeAsyncFg, theme.badgeAsyncBg) : '';
  const modelBadge = p.model
    ? buildBadge(p.model, theme.badgeModelFg, theme.badgeModelBg)
    : buildBadge('QUICK', theme.badgeModelFg, theme.badgeModelBg);
  const badgesStr = [asyncBadge, modelBadge].filter(Boolean).join(' ');
  const badgesVisual = measureWidth(stripAnsi(badgesStr));

  // ---- Line 1: header (agentCardHeaderBg) ----
  const headerName = `${theme.agentAccentFg}✦${RESET}${theme.agentCardHeaderBg} ${theme.agentAccentFg}${BOLD}${p.agentType.toUpperCase()} AGENT${RESET}${theme.agentCardHeaderBg}`;
  const headerLeft = `${theme.agentCardHeaderBg} ${icon}${theme.agentCardHeaderBg} ${headerName}`;
  // visual width of left side (stripped)
  // visual: " " + icon + " " + "✦" + " " (=5) + "NAME AGENT"
  const leftVisual = 5 + measureWidth(`${p.agentType.toUpperCase()} AGENT`);
  const gapSize = Math.max(1, width - 1 - leftVisual - badgesVisual - 1); // -1 accent, -1 right pad
  const headerLine = `${bar}${headerLeft}${' '.repeat(gapSize)}${badgesStr}${theme.agentCardHeaderBg} ${RESET}`;
  lines.push(headerLine);
  bgs.push(theme.agentCardHeaderBg);

  // ---- Line 2: description (toolMsgBg, bold) ----
  const descMax = Math.max(1, width - 4); // accent(1) + "   "(3)
  const descTrunc = fitWidth(p.description, descMax);
  const descLine = `${bar}   ${theme.titleFg}${BOLD}${descTrunc}${RESET}`;
  lines.push(descLine);
  bgs.push(theme.toolMsgBg);

  if (p.prompt) {
    // ---- Box: PROMPT PAYLOAD ----
    // box width = width - 4 (accent + 3 indent before box)
    const boxWidth = Math.max(10, width - 4);
    lines.push(`${bar}   ${theme.textDim}${boxTopBorder(' PROMPT PAYLOAD ', boxWidth)}${RESET}`);
    bgs.push(theme.toolMsgBg);

    // inner content width = boxWidth - 4 ("│ " + " │")
    const contentWidth = Math.max(1, boxWidth - 4);
    const promptLines = p.prompt.split('\n').flatMap(l => wrapText(l, contentWidth));
    for (const pLine of promptLines) {
      lines.push(`${bar}   ${boxContentLine(pLine, `${theme.agentPromptFg}${ITALIC}`, contentWidth)}`);
      bgs.push(theme.agentPromptBoxBg);
    }

    lines.push(`${bar}   ${theme.textDim}${boxBottomBorder(boxWidth)}${RESET}`);
    bgs.push(theme.toolMsgBg);
  }

  // ---- Footer ----
  pushHudFooter(lines, bgs, bar, width, { dashed: true, bg: theme.agentCardFooterBg });

  return { lines, bgs };
}

function renderTaskHudReduced(msg: ChatMessage, width: number): { lines: string[]; bgs: (string | null)[] } {
  const p = extractTaskParams(msg);
  const icon = statusIcon(p.status);
  const lines: string[] = [];
  const bgs: (string | null)[] = [];
  const bar = accentBar();

  const asyncBadge = p.isAsync ? buildBadge('ASYNC', theme.badgeAsyncFg, theme.badgeAsyncBg) : '';
  const modelBadge = p.model
    ? buildBadge(p.model, theme.badgeModelFg, theme.badgeModelBg)
    : buildBadge('QUICK', theme.badgeModelFg, theme.badgeModelBg);
  const badgesStr = [asyncBadge, modelBadge].filter(Boolean).join(' ');
  const badgesVisual = measureWidth(stripAnsi(badgesStr));

  // ---- Header ----
  const headerLeft = ` ${icon} ${theme.agentAccentFg}✦${RESET} ${theme.agentAccentFg}${BOLD}${p.agentType.toUpperCase()} AGENT${RESET}`;
  const leftVisual = measureWidth(stripAnsi(headerLeft));
  const gapSize = Math.max(1, width - 1 - leftVisual - badgesVisual - 1);
  lines.push(`${bar}${headerLeft}${' '.repeat(gapSize)}${badgesStr} `);
  bgs.push(theme.toolMsgBg);

  // ---- Description ----
  const descMax = Math.max(1, width - 4);
  lines.push(`${bar}   ${theme.titleFg}${BOLD}${fitWidth(p.description, descMax)}${RESET}`);
  bgs.push(theme.toolMsgBg);

  if (p.prompt) {
    // blank line
    lines.push(`${bar}`);
    bgs.push(theme.toolMsgBg);

    // prompt as prose, indented
    const contentWidth = Math.max(1, width - 5);
    const promptLines = p.prompt.split('\n').flatMap(l => wrapText(l, contentWidth));
    for (const pLine of promptLines) {
      lines.push(`${bar}   ${theme.agentPromptFg}${ITALIC}${pLine}${RESET}`);
      bgs.push(theme.toolMsgBg);
    }

    lines.push(`${bar}`);
    bgs.push(theme.toolMsgBg);
  }

  // footer
  pushHudFooter(lines, bgs, bar, width, { dashed: false, bg: theme.toolMsgBg });

  return { lines, bgs };
}

function renderTaskHudMinimal(msg: ChatMessage, width: number): { lines: string[]; bgs: (string | null)[] } {
  const p = extractTaskParams(msg);
  const icon = statusIcon(p.status);
  const lines: string[] = [];
  const bgs: (string | null)[] = [];
  const bar = accentBar();

  // ---- Header (no uppercase, no badges) ----
  lines.push(`${bar} ${icon} ${theme.agentAccentFg}✦${RESET} ${theme.agentAccentFg}${BOLD}${p.agentType}${RESET}`);
  bgs.push(theme.toolMsgBg);

  // ---- Description ----
  const descMax = Math.max(1, width - 4);
  lines.push(`${bar}   ${theme.titleFg}${BOLD}${fitWidth(p.description, descMax)}${RESET}`);
  bgs.push(theme.toolMsgBg);

  if (p.prompt) {
    lines.push(`${bar}`);
    bgs.push(theme.toolMsgBg);

    const contentWidth = Math.max(1, width - 5);
    const promptLines = p.prompt.split('\n').flatMap(l => wrapText(l, contentWidth));
    for (const pLine of promptLines) {
      lines.push(`${bar}   ${theme.agentPromptFg}${ITALIC}${pLine}${RESET}`);
      bgs.push(theme.toolMsgBg);
    }

    lines.push(`${bar}`);
    bgs.push(theme.toolMsgBg);
  }

  // footer — minimal: só hint
  const hintText = 'Ctrl+E recolher';
  lines.push(`${bar}   ${theme.textMuted}${DIM}${hintText}${RESET}`);
  bgs.push(theme.toolMsgBg);

  return { lines, bgs };
}

function renderTaskTextOnly(msg: ChatMessage, width: number): { lines: string[]; bgs: (string | null)[] } {
  const p = extractTaskParams(msg);
  const icon = statusIcon(p.status);
  // 1 line: "✓ Explore: description"
  const prefix = `${icon} ${theme.agentAccentFg}${BOLD}${p.agentType}${RESET}${theme.textDim}: ${RESET}`;
  const prefixVisual = 2 + measureWidth(p.agentType) + 2; // "✓ " + name + ": "
  const descMax = Math.max(1, width - prefixVisual);
  const line = `${prefix}${theme.textDim}${fitWidth(p.description, descMax)}${RESET}`;
  return { lines: [line], bgs: [null] };
}

function renderTaskToolMessage(msg: ChatMessage, width: number): { lines: string[]; bgs: (string | null)[] } {
  const collapsed = msg.toolCollapsed !== false;
  if (collapsed) return renderTaskCollapsed(msg, width);
  if (width >= TASK_HUD_FULL_MIN_WIDTH) return renderTaskHudFull(msg, width);
  if (width >= TASK_HUD_REDUCED_MIN_WIDTH) return renderTaskHudReduced(msg, width);
  if (width >= TASK_HUD_MINIMAL_MIN_WIDTH) return renderTaskHudMinimal(msg, width);
  return renderTaskTextOnly(msg, width);
}

// ============================================================================
// TaskOutput tool HUD — espelha o Task tool HUD, mas mostra resultado do agent
// em vez de prompt. Badges, accent bar e box label mudam por estado (success/error).
// ============================================================================

export interface TurnMeta {
  index: number;
  mode: string;
  status: string;
  durationMs: number;
  toolsUsed: string[];
}

export interface TaskOutputMeta {
  agentType: string;
  description: string;
  status: string;
  durationMs: number;
  resultText: string;
  errorsText: string;
  isError: boolean;
  toolsUsed: string[];
  projectName: string;
  turnIndex?: number;
  turns?: TurnMeta[];
}

export function parseDurationToMs(s: string): number {
  const msMatch = s.match(/^(\d+)ms$/);
  if (msMatch) return parseInt(msMatch[1], 10);
  const sMatch = s.match(/^(\d+(?:\.\d+)?)s$/);
  if (sMatch) return Math.round(parseFloat(sMatch[1]) * 1000);
  return 0;
}

export function extractTaskOutputMeta(msg: ChatMessage): TaskOutputMeta | null {
  const output = msg.toolOutput ?? [];
  if (output.length === 0) return null;

  let agentType = '';
  let description = '';
  let status = '';
  let durationMs = 0;
  let resultStart = -1;
  let errorsStart = -1;
  let toolsUsed: string[] = [];
  let projectName = '';
  let turnIndex: number | undefined;
  let turnsBlockStart = -1;

  for (let i = 0; i < output.length; i++) {
    const line = output[i];
    if (line.startsWith('Agent: ')) {
      agentType = line.slice(7).trim();
    } else if (line.startsWith('Description: ')) {
      description = line.slice(13).trim();
    } else if (line.startsWith('Status: ')) {
      status = line.slice(8).trim();
    } else if (line.startsWith('Duration: ')) {
      durationMs = parseDurationToMs(line.slice(10).trim());
    } else if (line.startsWith('Tools used: ')) {
      toolsUsed = line.slice(12).split(', ').filter(s => s.length > 0);
    } else if (line.startsWith('Project: ')) {
      projectName = line.slice(9).trim();
    } else if (line === 'Result:') {
      resultStart = i + 1;
    } else if (line === 'Errors:') {
      errorsStart = i + 1;
    } else if (
      turnsBlockStart < 0 &&
      /^Turns: \d+/.test(line) &&
      (i === 0 || output[i - 1].trim() === '')
    ) {
      // Só reconhece o bloco Turns quando precedido por linha vazia (separador
      // estrutural do output). Evita falso-positivo se o texto de Result contém
      // uma linha que por acaso começa com "Turns: N".
      turnsBlockStart = i;
    } else if (turnIndex === undefined) {
      const turnHeaderMatch = line.match(/^Turn (\d+):$/);
      if (turnHeaderMatch) turnIndex = parseInt(turnHeaderMatch[1], 10);
    }
  }

  // Agent: é o marcador obrigatório — sem ele não é um TaskOutput de agent
  if (!agentType) return null;

  let resultText = '';
  let errorsText = '';

  if (resultStart >= 0) {
    const candidates = [output.length];
    if (errorsStart >= 0 && errorsStart > resultStart) candidates.push(errorsStart - 1);
    if (turnsBlockStart >= 0 && turnsBlockStart > resultStart) candidates.push(turnsBlockStart);
    const end = Math.min(...candidates);
    resultText = output.slice(resultStart, end).join('\n').trim();
  }
  if (errorsStart >= 0) {
    const errCandidates = [output.length];
    if (turnsBlockStart >= 0 && turnsBlockStart > errorsStart) errCandidates.push(turnsBlockStart);
    const end = Math.min(...errCandidates);
    errorsText = output.slice(errorsStart, end).join('\n').trim();
  }

  let turns: TurnMeta[] | undefined;
  if (turnsBlockStart >= 0) {
    const turnLineRe = /^\s{2}\[(\d+)\] (\S+) · (\S+) · (\S+) · tools: (.+)$/;
    const parsed: TurnMeta[] = [];
    for (let i = turnsBlockStart + 1; i < output.length; i++) {
      const m = output[i].match(turnLineRe);
      if (!m) break;
      const rawTools = m[5].trim();
      parsed.push({
        index: parseInt(m[1], 10),
        mode: m[2],
        status: m[3],
        durationMs: parseDurationToMs(m[4]),
        toolsUsed: rawTools === '-' ? [] : rawTools.split(', ').filter(s => s.length > 0),
      });
    }
    if (parsed.length > 0) turns = parsed;
  }

  // Falha é determinada pelo status reportado, não pela mera presença de uma
  // seção Errors: — um agent pode concluir (completed) e ainda emitir warnings
  // não-fatais ali sem que isso conte como falha.
  const isError =
    msg.toolStatus === 'error' ||
    status.toLowerCase() === 'failed' ||
    status.toLowerCase() === 'error';

  const meta: TaskOutputMeta = {
    agentType: agentType.charAt(0).toUpperCase() + agentType.slice(1),
    description,
    status,
    durationMs,
    resultText,
    errorsText,
    isError,
    toolsUsed,
    projectName,
  };
  if (turnIndex !== undefined) meta.turnIndex = turnIndex;
  if (turns) meta.turns = turns;
  return meta;
}

function formatDurationSec(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function buildTaskOutputBadges(meta: TaskOutputMeta): string {
  const badges: string[] = [];
  if (meta.turns && meta.turns.length > 1) {
    badges.push(buildBadge(`${meta.turns.length} TURNS`, theme.badgeModelFg, theme.badgeModelBg));
  }
  badges.push(meta.isError
    ? buildBadge('FAILED', theme.dangerFg, theme.badgeFailedBg)
    : buildBadge('COMPLETED', theme.successFg, theme.badgeCompletedBg));
  if (meta.durationMs > 0) {
    badges.push(buildBadge(formatDurationSec(meta.durationMs), theme.badgeModelFg, theme.badgeModelBg));
  }
  return badges.join(' ');
}

function buildTaskOutputMetadataText(meta: TaskOutputMeta, isMultiTurn: boolean): string {
  const parts: string[] = [];
  if (!isMultiTurn && meta.toolsUsed.length > 0) {
    parts.push(`Tools: ${meta.toolsUsed.join(', ')}`);
  }
  if (meta.projectName) {
    parts.push(`Project: ${meta.projectName}`);
  }
  return parts.join(' · ');
}

function renderTurnsBlock(
  turns: TurnMeta[],
  bar: string,
  width: number,
): { lines: string[]; bgs: (string | null)[] } {
  const lines: string[] = [];
  const bgs: (string | null)[] = [];
  const boxWidth = Math.max(10, width - 4);
  lines.push(`${bar}   ${theme.textDim}${boxTopBorder(` TURNS (${turns.length}) `, boxWidth)}${RESET}`);
  bgs.push(theme.toolMsgBg);

  const contentWidth = Math.max(1, boxWidth - 4);
  const truncated = turns.length > MAX_TASK_OUTPUT_TURNS_LINES;
  const visible = truncated ? turns.slice(0, MAX_TASK_OUTPUT_TURNS_LINES) : turns;

  for (const t of visible) {
    const toolsStr = t.toolsUsed.length > 0 ? t.toolsUsed.join(', ') : '-';
    const raw = `[${t.index}] ${t.mode} · ${t.status} · ${formatDurationSec(t.durationMs)} · ${toolsStr}`;
    lines.push(`${bar}   ${boxContentLine(raw, theme.agentPromptFg, contentWidth)}`);
    bgs.push(theme.agentPromptBoxBg);
  }

  if (truncated) {
    const remaining = turns.length - MAX_TASK_OUTPUT_TURNS_LINES;
    const truncLabel = `[+${remaining} turns — abra o sidebar pra ver]`;
    lines.push(`${bar}   ${boxContentLine(truncLabel, `${theme.textMuted}${DIM}`, contentWidth)}`);
    bgs.push(theme.agentPromptBoxBg);
  }

  lines.push(`${bar}   ${theme.textDim}${boxBottomBorder(boxWidth)}${RESET}`);
  bgs.push(theme.toolMsgBg);

  return { lines, bgs };
}

function renderTaskOutputCollapsed(meta: TaskOutputMeta, width: number): { lines: string[]; bgs: (string | null)[] } {
  const icon = meta.isError ? `${theme.dangerFg}✗${RESET}` : `${theme.successFg}✓${RESET}`;
  const hintText = 'Ctrl+E expandir';
  const hintAnsi = `${theme.textMuted}${DIM}${hintText}${RESET}`;
  const agentMark = `${theme.agentAccentFg}✦${RESET} ${theme.agentAccentFg}${BOLD}${meta.agentType}${RESET}`;
  const agentVisual = measureWidth(`✦ ${meta.agentType}`);

  const showBadge = width >= TASK_HUD_REDUCED_MIN_WIDTH;
  const badgeLabel = meta.isError ? ' FAILED ' : ' COMPLETED ';
  const badgeStr = showBadge
    ? (meta.isError
        ? buildBadge('FAILED', theme.dangerFg, theme.badgeFailedBg)
        : buildBadge('COMPLETED', theme.successFg, theme.badgeCompletedBg))
    : '';
  const badgeVisual = showBadge ? measureWidth(badgeLabel) : 0;

  const multiTurnCount = meta.turns && meta.turns.length > 1 ? meta.turns.length : 0;
  const showTurnsBadge = showBadge && multiTurnCount > 0;
  const turnsBadgeStr = showTurnsBadge
    ? buildBadge(`${multiTurnCount} TURNS`, theme.badgeModelFg, theme.badgeModelBg)
    : '';
  const turnsBadgeVisual = showTurnsBadge ? measureWidth(` ${multiTurnCount} TURNS `) : 0;

  const overhead = 1 + 1 + agentVisual + 1 + (showBadge ? badgeVisual + 1 : 0) + (showTurnsBadge ? turnsBadgeVisual + 1 : 0) + 1 + hintText.length + 1;
  const descMax = Math.max(1, width - overhead);
  const descTruncated = fitWidth(meta.description, descMax);

  const leftBadgePart = showBadge ? ` ${badgeStr}` : '';
  const leftTurnsPart = showTurnsBadge ? ` ${turnsBadgeStr}` : '';
  const leftPart = `${icon} ${agentMark}${leftBadgePart}${leftTurnsPart} ${theme.textDim}${descTruncated}${RESET}`;
  const line = padEndAnsi(leftPart, width - hintText.length) + hintAnsi;
  return { lines: [line], bgs: [theme.toolMsgBg] };
}

function renderTaskOutputHudFull(meta: TaskOutputMeta, width: number): { lines: string[]; bgs: (string | null)[] } {
  const icon = meta.isError ? `${theme.dangerFg}✗${RESET}` : `${theme.successFg}✓${RESET}`;
  const accentColor = meta.isError ? theme.dangerFg : theme.agentAccentFg;
  const bar = `${accentColor}${BOLD}┃${RESET}`;
  const lines: string[] = [];
  const bgs: (string | null)[] = [];

  const badgesStr = buildTaskOutputBadges(meta);
  const badgesVisual = measureWidth(stripAnsi(badgesStr));

  // ---- Line 1: header (agentCardHeaderBg) ----
  const headerName = `${theme.agentAccentFg}✦${RESET}${theme.agentCardHeaderBg} ${theme.agentAccentFg}${BOLD}${meta.agentType.toUpperCase()} AGENT${RESET}${theme.agentCardHeaderBg}`;
  const headerLeft = `${theme.agentCardHeaderBg} ${icon}${theme.agentCardHeaderBg} ${headerName}`;
  // visual: " " + icon + " " + "✦" + " " (=5) + "NAME AGENT"
  const leftVisual = 5 + measureWidth(`${meta.agentType.toUpperCase()} AGENT`);
  const gapSize = Math.max(1, width - 1 - leftVisual - badgesVisual - 1);
  lines.push(`${bar}${headerLeft}${' '.repeat(gapSize)}${badgesStr}${theme.agentCardHeaderBg} ${RESET}`);
  bgs.push(theme.agentCardHeaderBg);

  // ---- Line 2: description ----
  const descMax = Math.max(1, width - 4);
  lines.push(`${bar}   ${theme.titleFg}${BOLD}${fitWidth(meta.description, descMax)}${RESET}`);
  bgs.push(theme.toolMsgBg);

  // ---- Line 3: metadata (Tools · Project) — opcional ----
  const isMultiTurn = !!(meta.turns && meta.turns.length > 1);
  const metadataText = buildTaskOutputMetadataText(meta, isMultiTurn);
  if (metadataText) {
    lines.push(`${bar}   ${theme.textDim}${fitWidth(metadataText, descMax)}${RESET}`);
    bgs.push(theme.toolMsgBg);
  }

  // ---- Box: TURNS (só multi-turn) ----
  if (isMultiTurn && meta.turns) {
    const turnsBlock = renderTurnsBlock(meta.turns, bar, width);
    lines.push(...turnsBlock.lines);
    bgs.push(...turnsBlock.bgs);
  }

  // ---- Box: RESULT / ERRORS ----
  const boxText = meta.isError ? meta.errorsText : meta.resultText;
  if (boxText) {
    const boxWidth = Math.max(10, width - 4);
    const label = meta.isError ? ' ERRORS ' : ' RESULT ';
    lines.push(`${bar}   ${theme.textDim}${boxTopBorder(label, boxWidth)}${RESET}`);
    bgs.push(theme.toolMsgBg);

    const contentWidth = Math.max(1, boxWidth - 4);
    const allLines = boxText.split('\n').flatMap(l => wrapText(l, contentWidth));
    const truncated = allLines.length > MAX_TASK_OUTPUT_RESULT_LINES;
    const displayLines = truncated ? allLines.slice(0, MAX_TASK_OUTPUT_RESULT_LINES) : allLines;
    const contentFg = meta.isError ? theme.dangerFg : theme.agentPromptFg;

    for (const pLine of displayLines) {
      lines.push(`${bar}   ${boxContentLine(pLine, contentFg, contentWidth)}`);
      bgs.push(theme.agentPromptBoxBg);
    }

    if (truncated) {
      const remaining = allLines.length - MAX_TASK_OUTPUT_RESULT_LINES;
      lines.push(`${bar}   ${boxContentLine(`[+${remaining} linhas]`, `${theme.textMuted}${DIM}`, contentWidth)}`);
      bgs.push(theme.agentPromptBoxBg);
    }

    lines.push(`${bar}   ${theme.textDim}${boxBottomBorder(boxWidth)}${RESET}`);
    bgs.push(theme.toolMsgBg);
  }

  // ---- Footer ----
  pushHudFooter(lines, bgs, bar, width, { dashed: true, bg: theme.agentCardFooterBg });

  return { lines, bgs };
}

function renderTaskOutputHudReduced(meta: TaskOutputMeta, width: number): { lines: string[]; bgs: (string | null)[] } {
  const icon = meta.isError ? `${theme.dangerFg}✗${RESET}` : `${theme.successFg}✓${RESET}`;
  const accentColor = meta.isError ? theme.dangerFg : theme.agentAccentFg;
  const bar = `${accentColor}${BOLD}┃${RESET}`;
  const lines: string[] = [];
  const bgs: (string | null)[] = [];

  const badgesStr = buildTaskOutputBadges(meta);
  const badgesVisual = measureWidth(stripAnsi(badgesStr));

  // Header
  const headerLeft = ` ${icon} ${theme.agentAccentFg}✦${RESET} ${theme.agentAccentFg}${BOLD}${meta.agentType.toUpperCase()} AGENT${RESET}`;
  const leftVisual = measureWidth(stripAnsi(headerLeft));
  const gapSize = Math.max(1, width - 1 - leftVisual - badgesVisual - 1);
  lines.push(`${bar}${headerLeft}${' '.repeat(gapSize)}${badgesStr} `);
  bgs.push(theme.toolMsgBg);

  // Description
  const descMax = Math.max(1, width - 4);
  lines.push(`${bar}   ${theme.titleFg}${BOLD}${fitWidth(meta.description, descMax)}${RESET}`);
  bgs.push(theme.toolMsgBg);

  // Metadata (Tools · Project) com degradação: se full não cabe, tenta só Project; se não cabe, omite
  const isMultiTurnReduced = !!(meta.turns && meta.turns.length > 1);
  const idealMetadata = buildTaskOutputMetadataText(meta, isMultiTurnReduced);
  if (idealMetadata) {
    let metadataLine = idealMetadata;
    if (measureWidth(metadataLine) > descMax && meta.projectName) {
      metadataLine = `Project: ${meta.projectName}`;
    }
    if (measureWidth(metadataLine) <= descMax) {
      lines.push(`${bar}   ${theme.textDim}${fitWidth(metadataLine, descMax)}${RESET}`);
      bgs.push(theme.toolMsgBg);
    }
  }

  // Result/errors prose
  const boxText = meta.isError ? meta.errorsText : meta.resultText;
  if (boxText) {
    lines.push(`${bar}`);
    bgs.push(theme.toolMsgBg);

    const contentWidth = Math.max(1, width - 5);
    const allLines = boxText.split('\n').flatMap(l => wrapText(l, contentWidth));
    const truncated = allLines.length > MAX_TASK_OUTPUT_RESULT_LINES;
    const displayLines = truncated ? allLines.slice(0, MAX_TASK_OUTPUT_RESULT_LINES) : allLines;
    const contentFg = meta.isError ? theme.dangerFg : theme.agentPromptFg;

    for (const pLine of displayLines) {
      lines.push(`${bar}   ${contentFg}${pLine}${RESET}`);
      bgs.push(theme.toolMsgBg);
    }

    if (truncated) {
      const remaining = allLines.length - MAX_TASK_OUTPUT_RESULT_LINES;
      lines.push(`${bar}   ${theme.textMuted}${DIM}[+${remaining} linhas]${RESET}`);
      bgs.push(theme.toolMsgBg);
    }

    lines.push(`${bar}`);
    bgs.push(theme.toolMsgBg);
  }

  // Footer
  pushHudFooter(lines, bgs, bar, width, { dashed: false, bg: theme.toolMsgBg });

  return { lines, bgs };
}

function renderTaskOutputHudMinimal(meta: TaskOutputMeta, width: number): { lines: string[]; bgs: (string | null)[] } {
  const icon = meta.isError ? `${theme.dangerFg}✗${RESET}` : `${theme.successFg}✓${RESET}`;
  const accentColor = meta.isError ? theme.dangerFg : theme.agentAccentFg;
  const bar = `${accentColor}${BOLD}┃${RESET}`;
  const lines: string[] = [];
  const bgs: (string | null)[] = [];

  const multiTurnCount = meta.turns && meta.turns.length > 1 ? meta.turns.length : 0;
  const headerLeftMinimal = `${bar} ${icon} ${theme.agentAccentFg}✦${RESET} ${theme.agentAccentFg}${BOLD}${meta.agentType}${RESET}`;
  if (multiTurnCount > 0) {
    const turnsBadge = buildBadge(`${multiTurnCount} TURNS`, theme.badgeModelFg, theme.badgeModelBg);
    lines.push(`${headerLeftMinimal} ${turnsBadge}`);
  } else {
    lines.push(headerLeftMinimal);
  }
  bgs.push(theme.toolMsgBg);

  const descMax = Math.max(1, width - 4);
  lines.push(`${bar}   ${theme.titleFg}${BOLD}${fitWidth(meta.description, descMax)}${RESET}`);
  bgs.push(theme.toolMsgBg);

  const boxText = meta.isError ? meta.errorsText : meta.resultText;
  if (boxText) {
    lines.push(`${bar}`);
    bgs.push(theme.toolMsgBg);

    const contentWidth = Math.max(1, width - 5);
    const allLines = boxText.split('\n').flatMap(l => wrapText(l, contentWidth));
    const truncated = allLines.length > MAX_TASK_OUTPUT_RESULT_LINES;
    const displayLines = truncated ? allLines.slice(0, MAX_TASK_OUTPUT_RESULT_LINES) : allLines;
    const contentFg = meta.isError ? theme.dangerFg : theme.agentPromptFg;

    for (const pLine of displayLines) {
      lines.push(`${bar}   ${contentFg}${pLine}${RESET}`);
      bgs.push(theme.toolMsgBg);
    }

    if (truncated) {
      const remaining = allLines.length - MAX_TASK_OUTPUT_RESULT_LINES;
      lines.push(`${bar}   ${theme.textMuted}${DIM}[+${remaining} linhas]${RESET}`);
      bgs.push(theme.toolMsgBg);
    }

    lines.push(`${bar}`);
    bgs.push(theme.toolMsgBg);
  }

  const hintText = 'Ctrl+E recolher';
  lines.push(`${bar}   ${theme.textMuted}${DIM}${hintText}${RESET}`);
  bgs.push(theme.toolMsgBg);

  return { lines, bgs };
}

function renderTaskOutputTextOnly(meta: TaskOutputMeta, width: number): { lines: string[]; bgs: (string | null)[] } {
  const icon = meta.isError ? `${theme.dangerFg}✗${RESET}` : `${theme.successFg}✓${RESET}`;
  const statusText = meta.isError ? 'failed' : 'completed';
  const prefix = `${icon} ${theme.agentAccentFg}${BOLD}${meta.agentType}${RESET}${theme.textDim}: ${RESET}`;
  const prefixVisual = 2 + measureWidth(meta.agentType) + 2;
  const descMax = Math.max(1, width - prefixVisual);
  const line = `${prefix}${theme.textDim}${fitWidth(statusText, descMax)}${RESET}`;
  return { lines: [line], bgs: [null] };
}

function renderTaskOutputToolMessage(msg: ChatMessage, width: number): { lines: string[]; bgs: (string | null)[] } | null {
  const meta = extractTaskOutputMeta(msg);
  if (!meta) return null;

  const collapsed = msg.toolCollapsed !== false;
  if (collapsed) return renderTaskOutputCollapsed(meta, width);
  if (width >= TASK_HUD_FULL_MIN_WIDTH) return renderTaskOutputHudFull(meta, width);
  if (width >= TASK_HUD_REDUCED_MIN_WIDTH) return renderTaskOutputHudReduced(meta, width);
  if (width >= TASK_HUD_MINIMAL_MIN_WIDTH) return renderTaskOutputHudMinimal(meta, width);
  return renderTaskOutputTextOnly(meta, width);
}

function renderToolMessage(msg: ChatMessage, width: number): { lines: string[], bgs: (string | null)[] } {
  // TaskOutput tool: HUD dedicado com parse defensivo.
  // Se o output não tem o formato esperado (ex: task type != agent), cai no render genérico.
  if ((msg.toolName ?? '').toLowerCase() === 'taskoutput') {
    const result = renderTaskOutputToolMessage(msg, width);
    if (result) return result;
  }
  // Task tool: visual dedicado (HUD com degradação por width)
  if ((msg.toolName ?? '').toLowerCase() === 'task') {
    return renderTaskToolMessage(msg, width);
  }

  // O consumidor (voxy-cli) já entrega o display name formatado: nativas
  // capitalizadas ("Read"/"Bash"), MCP como "filesystem:list_directory (MCP)".
  // A lib RENDERIZA o nome cru sem re-capitalizar — re-capitalizar quebrava o
  // header de tools MCP ("Filesystem:..."), divergindo do dialog de permissão.
  const name = msg.toolName ?? 'Tool';
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
    return {
      lines: [padEndAnsi(leftPart, width - hintText.length) + hintAnsi],
      bgs: [theme.toolMsgBg],
    };
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
  const bgs: string[] = [theme.toolMsgBg];

  // Input details
  const raw = msg.toolRawInput;
  if (raw) {
    for (const [key, value] of Object.entries(raw)) {
      const valStr = typeof value === 'string' ? value : JSON.stringify(value);
      const cleanVal = valStr.replace(/\t/g, '  ');
      const maxValWidth = Math.max(1, width - key.length - 4); // "  key: "

      const valLines = cleanVal.split('\n').flatMap(line => wrapText(line, maxValWidth));
      if (valLines.length === 0) valLines.push('');

      lines.push(fitWidth(`  ${theme.textDim}${key}: ${valLines[0]}${RESET}`, width));
      bgs.push(theme.toolMsgBg);

      for (let vi = 1; vi < valLines.length; vi++) {
        lines.push(
          fitWidth(`  ${theme.textDim}↳${RESET} ${theme.textDim}${valLines[vi]}${RESET}`, width),
        );
        bgs.push(theme.toolMsgBg);
      }
    }
  } else if (msg.toolInput) {
    const cleanInput = (msg.toolInput ?? '').replace(/\t/g, '  ');
    const maxInputWidth = Math.max(1, width - 2);
    const inputLines = cleanInput.split('\n').flatMap(line => wrapText(line, maxInputWidth));
    if (inputLines.length === 0) inputLines.push('');

    lines.push(fitWidth(`  ${theme.textDim}${inputLines[0]}${RESET}`, width));
    bgs.push(theme.toolMsgBg);

    for (let ii = 1; ii < inputLines.length; ii++) {
      lines.push(
        fitWidth(`  ${theme.textDim}↳${RESET} ${theme.textDim}${inputLines[ii]}${RESET}`, width),
      );
      bgs.push(theme.toolMsgBg);
    }
  }

  // Separador fino entre input e output
  lines.push(`  ${theme.borderFg}${'─'.repeat(Math.max(0, width - 2))}${RESET}`);
  bgs.push(theme.toolMsgBg);

  // Output completo
  if (output.length > 0) {
    const isEdit = name === 'Edit';
    const isWrite = name === 'Write';

    // Edit/Write: linhas de diff têm prefixos (-/+/< /> ) de 2 chars + 2 indent = 4
    // Demais precisam de 2 chars (indent)
    const maxLineWidth = (isEdit || isWrite)
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

        // Background padrão para output — pode ser sobrescrito abaixo
        let lineBg = theme.toolMsgBg;

        // Colorir linhas de diff para Edit
        if (isEdit) {
          const stripped = stripAnsi(renderedLine);
          if (stripped.startsWith('-') || stripped.startsWith('< ')) {
            renderedLine = `${theme.diffDelFg}${stripped}${RESET}`;
            lineBg = theme.diffDelBg;
          } else if (stripped.startsWith('+') || stripped.startsWith('> ')) {
            renderedLine = `${theme.diffAddFg}${stripped}${RESET}`;
            lineBg = theme.diffAddBg;
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
            lineBg = theme.diffAddBg;
          }
        }

        // Indentação de 2 espaços + fitWidth para garantir largura exata
        lines.push(fitWidth(`  ${renderedLine}`, width));
        bgs.push(lineBg);
      }
    }
  }

  // SEM separador trailing — gerenciado por buildAllLines
  return { lines, bgs };
}

function renderMessage(msg: ChatMessage, width: number, thinkingBlock?: ThinkingBlock): { lines: string[], bgs: (string | null)[] } {
  let header: string;
  const time = `${theme.textDim}${DIM}${formatTime(msg.timestamp)}${RESET}`;

  switch (msg.role) {
    case 'user':
      header = `${theme.userTextFg}${BOLD}⬥ You${RESET} ${time}`;
      break;
    case 'assistant':
      header = `${theme.selectedFg}${BOLD}✦ Assistant${RESET} ${time}`;
      break;
    case 'system':
      header = `${theme.textDim}${ITALIC}▸ System${RESET} ${time}`;
      break;
    case 'tool': {
      const toolResult = renderToolMessage(msg, width);
      return { lines: toolResult.lines, bgs: toolResult.bgs };
    }
  }

  const thinkingLines = thinkingBlock ? thinkingBlock.render(width, 10000) : [];
  const contentLines = msg.role === 'assistant'
    ? renderMarkdown(msg.content, width)
    : wrapText(msg.content, width).map(line => `${theme.userTextFg}${theme.userTextStyle}${line}${RESET}`);
  const separator = `${theme.borderFg}${DIM}${'─'.repeat(width)}${RESET}`;
  const allLines = [header, ...thinkingLines, ...contentLines, separator];
  // Determinar background por role
  let msgBg: string | null = null;
  if (msg.role === 'user') {
    msgBg = theme.userMsgBg;
  } else if (msg.role === 'assistant') {
    msgBg = theme.assistantMsgBg;
  }
  return { lines: allLines, bgs: allLines.map((_, i) => i === allLines.length - 1 ? null : msgBg) };
}

interface BuildResult {
  lines: string[];
  borders: string[];
  thinkingMap: Map<number, ThinkingBlock>;
  msgMap: (ChatMessage | null)[];
  msgStartMap: Map<ChatMessage, number>;
  lineBgs: (string | null)[];
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
  private renderMsg(msg: ChatMessage, width: number): { lines: string[], bgs: (string | null)[] } {
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
    const lineBgs: (string | null)[] = [];

    let prevWasTool = false;

    for (const msg of this.messages) {
      const isTool = msg.role === 'tool';

      // Transição tool→non-tool: injetar separador
      if (prevWasTool && !isTool) {
        const sep = `${theme.borderFg}${'─'.repeat(textWidth)}${RESET}`;
        lines.push(sep);
        borders.push(getMsgBorderAnsi('tool'));
        msgMap.push(null);
        lineBgs.push(null);
      }

      msgStartMap.set(msg, lines.length);
      const lineStart = lines.length;
      const msgResult = this.renderMsg(msg, textWidth);

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
      for (let li = 0; li < msgResult.lines.length; li++) {
        lines.push(msgResult.lines[li]);
        borders.push(borderChar);
        msgMap.push(msg);
        lineBgs.push(msgResult.bgs[li] ?? null);
      }

      prevWasTool = isTool;
    }

    return { lines, borders, thinkingMap, msgMap, msgStartMap, lineBgs };
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

  toggleLastTool(): boolean {
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
    return start + (screenY - 1);
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
    const oldLen = this.renderMsg(msg, textWidth).lines.length

    msg.toolCollapsed = !msg.toolCollapsed

    const newLen = this.renderMsg(msg, textWidth).lines.length
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
    const { lines: allLines, borders: allLineBorders, thinkingMap, lineBgs: allLineBgs } = this.buildAllLines(textWidth);
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
          const composed = fitWidth(border + ' ' + hl, width)
          return applyLineBg(composed, allLineBgs[i])
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

    const sliced = allLines.slice(start, end);
    return sliced.map((line, i) => {
      const allLineIdx = start + i;
      const hl = this.applySelHL(line, allLineIdx, selFromIdx, selFromX, selToIdx, selToX);
      const border = allLineBorders[allLineIdx] ?? ' ';
      const composed = border + ' ' + fitWidth(hl, textWidth) + SCROLLBAR_SEP + scrollbar[i];
      return applyLineBg(composed, allLineBgs[allLineIdx]);
    });
  }
}
