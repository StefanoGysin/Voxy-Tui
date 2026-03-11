// Prefixo
export const ESC = '\x1b';
export const CSI = '\x1b[';

// Synchronized Output (DEC Mode 2026)
export const SYNC_START = '\x1b[?2026h';
export const SYNC_END   = '\x1b[?2026l';

// Cursor
export const CURSOR_HIDE = '\x1b[?25l';
export const CURSOR_SHOW = '\x1b[?25h';
export const CURSOR_SAVE = '\x1b7';      // DEC save (compatível com macOS Terminal.app)
export const CURSOR_RESTORE = '\x1b8';  // DEC restore

// Funções de cursor (retornam string)
export function cursorUp(n: number): string { return `\x1b[${n}A`; }
export function cursorDown(n: number): string { return `\x1b[${n}B`; }
export function cursorForward(n: number): string { return `\x1b[${n}C`; }
export function cursorBack(n: number): string { return `\x1b[${n}D`; }
export function cursorTo(row: number, col: number): string { return `\x1b[${row};${col}H`; }
export function cursorCol(n: number): string { return `\x1b[${n}G`; }

// Erase
export const ERASE_LINE = '\x1b[2K';           // Apaga linha inteira
export const ERASE_LINE_END = '\x1b[0K';       // Apaga do cursor ao fim da linha
export const ERASE_DOWN = '\x1b[0J';           // Apaga do cursor ao fim da tela
export const ERASE_SCREEN = '\x1b[2J';         // Apaga tela inteira
export const ERASE_SCROLLBACK = '\x1b[3J';     // Apaga tela + scrollback

// SGR — Estilos
export const RESET = '\x1b[0m';
export const BOLD = '\x1b[1m';
export const DIM = '\x1b[2m';
export const ITALIC = '\x1b[3m';
export const UNDERLINE = '\x1b[4m';
export const STRIKETHROUGH = '\x1b[9m';

// Cores 16 (fg 30-37, bright fg 90-97)
export const FG_BLACK   = '\x1b[30m';
export const FG_RED     = '\x1b[31m';
export const FG_GREEN   = '\x1b[32m';
export const FG_YELLOW  = '\x1b[33m';
export const FG_BLUE    = '\x1b[34m';
export const FG_MAGENTA = '\x1b[35m';
export const FG_CYAN    = '\x1b[36m';
export const FG_WHITE   = '\x1b[37m';
export const FG_GRAY    = '\x1b[90m';  // bright black

// Funções de cor TrueColor
export function fg(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`;
}
export function bg(r: number, g: number, b: number): string {
  return `\x1b[48;2;${r};${g};${b}m`;
}
export function fg256(id: number): string { return `\x1b[38;5;${id}m`; }
export function bg256(id: number): string { return `\x1b[48;5;${id}m`; }
