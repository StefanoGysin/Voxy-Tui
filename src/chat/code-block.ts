import { highlight, supportsLanguage } from 'cli-highlight';
import type { Component } from '../core/component';
import { RESET, BOLD, DIM, FG_BLUE, FG_CYAN, FG_GREEN, FG_YELLOW, FG_GRAY, FG_RED } from '../core/ansi';

// Tema ANSI puro — não depende de chalk/TTY
const ANSI_THEME = {
  keyword:        (s: string) => `${FG_BLUE}${s}${RESET}`,
  built_in:       (s: string) => `${FG_CYAN}${s}${RESET}`,
  type:           (s: string) => `${FG_YELLOW}${s}${RESET}`,
  literal:        (s: string) => `${FG_YELLOW}${s}${RESET}`,
  number:         (s: string) => `${FG_YELLOW}${s}${RESET}`,
  string:         (s: string) => `${FG_GREEN}${s}${RESET}`,
  comment:        (s: string) => `${FG_GRAY}${DIM}${s}${RESET}`,
  function:       (s: string) => `${FG_CYAN}${s}${RESET}`,
  title:          (s: string) => `${FG_CYAN}${s}${RESET}`,
  'meta-keyword': (s: string) => `${FG_BLUE}${s}${RESET}`,
  variable:       (s: string) => `${FG_RED}${s}${RESET}`,
  default:        (s: string) => s,
};

export function highlightCode(code: string, lang: string): string {
  const safeLang = lang && supportsLanguage(lang) ? lang : 'plaintext';
  try {
    return highlight(code, { language: safeLang, ignoreIllegals: true, theme: ANSI_THEME });
  } catch {
    return code;
  }
}

export class CodeBlock implements Component {
  private code = '';
  private lang = '';

  constructor(code = '', lang = '') {
    this.code = code;
    this.lang = lang;
  }

  setContent(code: string): void { this.code = code; }
  setLang(lang: string): void    { this.lang = lang; }

  render(_width: number, _height: number): string[] {
    const lines: string[] = [];

    if (this.lang) {
      lines.push(`${FG_GRAY}── ${this.lang} ──${RESET}`);
    }

    const highlighted = highlightCode(this.code, this.lang);
    for (const line of highlighted.split('\n')) {
      lines.push(`  ${line}`);
    }

    return lines;
  }
}
