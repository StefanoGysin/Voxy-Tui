import type { KeyEvent, MouseClickEvent, MouseDragEvent } from '../core/component';

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

/**
 * Detecta focus events do terminal (mode 1004).
 * \x1b[I = focus-in, \x1b[O = focus-out.
 * Retorna null para qualquer outra sequência.
 */
export function parseFocusEvent(seq: string): 'focus-in' | 'focus-out' | null {
  if (seq === '\x1b[I') return 'focus-in';
  if (seq === '\x1b[O') return 'focus-out';
  return null;
}

/**
 * Detecta eventos de scroll do mouse no formato SGR (mode 1006).
 * Formato: \x1b[<btn;x;yM (press) ou \x1b[<btn;x;ym (release)
 * btn=64 → scroll up, btn=65 → scroll down.
 * Retorna null para qualquer outra sequência.
 */
export function parseMouseScroll(seq: string): 'scroll-up' | 'scroll-down' | null {
  if (!seq.startsWith('\x1b[<')) return null;
  const inner = seq.slice(3);
  const lastChar = inner.slice(-1);
  if (lastChar !== 'M') return null;
  const parts = inner.slice(0, -1).split(';');
  if (parts.length < 3) return null;
  const btn = parseInt(parts[0], 10);
  if (Number.isNaN(btn)) return null;
  if (btn === 64) return 'scroll-up';
  if (btn === 65) return 'scroll-down';
  return null;
}

/**
 * Tenta interpretar uma sequência SGR como evento de clique de mouse.
 * Formato: \x1b[<btn;x;yM (press) ou \x1b[<btn;x;ym (release)
 *
 * btn=0 → esquerdo, btn=1 → meio, btn=2 → direito.
 * Bit 2=shift, bit 3=meta, bit 4=ctrl (ignorados por ora).
 * btn>=32 → movimento/scroll → retorna null.
 *
 * Retorna null para qualquer sequência não reconhecida.
 */
export function parseMouseClick(seq: string): MouseClickEvent | null {
  if (!seq.startsWith('\x1b[<')) return null;
  const inner = seq.slice(3);
  const lastChar = inner.slice(-1);
  if (lastChar !== 'M' && lastChar !== 'm') return null;
  const parts = inner.slice(0, -1).split(';');
  if (parts.length < 3) return null;
  const btn = parseInt(parts[0], 10);
  const x   = parseInt(parts[1], 10);
  const y   = parseInt(parts[2], 10);
  if (Number.isNaN(btn) || Number.isNaN(x) || Number.isNaN(y)) return null;
  // Excluir scroll (btn >= 64) e movimento (btn & 32 !== 0)
  if (btn >= 64 || (btn & 32) !== 0) return null;
  return {
    x,
    y,
    button: btn & 3,
    isRelease: lastChar === 'm',
  };
}

/**
 * Tenta interpretar uma sequência SGR como evento de drag do mouse.
 * Formato: \x1b[<btn;x;yM onde btn & 32 !== 0 e btn < 64.
 *
 * btn=32 → esquerdo+move, btn=33 → meio+move, btn=34 → direito+move.
 * Retorna null para qualquer sequência não reconhecida.
 */
export function parseMouseDrag(seq: string): MouseDragEvent | null {
  if (!seq.startsWith('\x1b[<')) return null;
  const inner = seq.slice(3);
  const lastChar = inner.slice(-1);
  if (lastChar !== 'M') return null;          // drag nunca emite 'm' (release)
  const parts = inner.slice(0, -1).split(';');
  if (parts.length < 3) return null;
  const btn = parseInt(parts[0], 10);
  const x   = parseInt(parts[1], 10);
  const y   = parseInt(parts[2], 10);
  if (Number.isNaN(btn) || Number.isNaN(x) || Number.isNaN(y)) return null;
  // Drag: bit 32 set, não é scroll (btn < 64)
  if ((btn & 32) === 0 || btn >= 64) return null;
  return { x, y, button: btn & 3 };
}
