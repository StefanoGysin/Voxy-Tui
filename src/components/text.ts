import type { Component } from '../core/component';
import { RESET } from '../core/ansi';
import { wrapText } from '../utils/wrap';
import { measureWidth } from '../utils/width';
import { stripAnsi } from '../utils/strip-ansi';

export interface TextOptions {
  /** Prefixo ANSI de cor/estilo (ex: FG_CYAN + BOLD). Default: sem cor */
  color?: string;
  /** Quebrar em multiplas linhas se ultrapassar largura. Default: false */
  wrap?: boolean;
  /** Alinhar conteudo: 'left' | 'center' | 'right'. Default: 'left' */
  align?: 'left' | 'center' | 'right';
}

export class Text implements Component {
  private content: string;
  private options: TextOptions;

  constructor(content: string, options: TextOptions = {}) {
    this.content = content;
    this.options = options;
  }

  update(content: string): void {
    this.content = content;
  }

  render(width: number, _height: number): string[] {
    const { color = '', wrap = false, align = 'left' } = this.options;
    const suffix = color ? RESET : '';

    const rawLines = wrap
      ? wrapText(this.content, width)
      : [this.content];

    return rawLines.map(line => {
      const aligned = this.alignLine(line, width, align);
      return color + aligned + suffix;
    });
  }

  private alignLine(line: string, width: number, align: 'left' | 'center' | 'right'): string {
    if (align === 'left') return line;
    const visualLen = measureWidth(stripAnsi(line));
    if (visualLen >= width) return line;
    const pad = width - visualLen;
    if (align === 'right') return ' '.repeat(pad) + line;
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return ' '.repeat(left) + line + ' '.repeat(right);
  }
}
