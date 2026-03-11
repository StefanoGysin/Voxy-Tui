import type { KeyEvent } from '../core/component';

/**
 * Formato do objeto key emitido pelo Node.js readline.emitKeypressEvents().
 * Definido aqui para não depender de @types/node diretamente nos componentes.
 */
export interface RawKey {
  sequence: string;
  name?: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
}

/**
 * Converte o objeto key do Node.js readline para o KeyEvent da voxy-tui.
 * Normaliza nomes de teclas para strings lowercase consistentes.
 */
export function parseKey(raw: RawKey): KeyEvent {
  return {
    key: normalizeKeyName(raw),
    ctrl: raw.ctrl ?? false,
    meta: raw.meta ?? false,
    shift: raw.shift ?? false,
    raw: raw.sequence ?? '',
  };
}

function normalizeKeyName(raw: RawKey): string {
  if (raw.name) return raw.name.toLowerCase();
  const seq = raw.sequence ?? '';
  // Backspace (pode chegar como \x7f ou \x08)
  if (seq === '\x7f' || seq === '\x08') return 'backspace';
  // Enter
  if (seq === '\r' || seq === '\n') return 'return';
  // Tab
  if (seq === '\t') return 'tab';
  // Escape
  if (seq === '\x1b') return 'escape';
  // Caractere imprimível
  if (seq.length === 1 && seq >= ' ') return seq;
  return seq;
}

/**
 * Sequências de controle para bracketed paste mode.
 * Habilitar no inicio da aplicação, desabilitar no exit.
 */
export const BRACKETED_PASTE_ENABLE  = '\x1b[?2004h';
export const BRACKETED_PASTE_DISABLE = '\x1b[?2004l';
export const BRACKETED_PASTE_START   = '\x1b[200~';
export const BRACKETED_PASTE_END     = '\x1b[201~';

/**
 * Detecta se uma sequência raw é o início de um paste com bracketed paste mode.
 */
export function isBracketedPasteStart(raw: string): boolean {
  return raw === BRACKETED_PASTE_START;
}
