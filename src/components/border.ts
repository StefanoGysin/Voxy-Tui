import type { Component } from '../core/component';
import { padEndAnsi } from '../utils/width';

export type BorderStyle = 'single' | 'double' | 'rounded';

const CHARS: Record<BorderStyle, { tl: string; tr: string; bl: string; br: string; h: string; v: string }> = {
  single:  { tl: '\u250C', tr: '\u2510', bl: '\u2514', br: '\u2518', h: '\u2500', v: '\u2502' },
  double:  { tl: '\u2554', tr: '\u2557', bl: '\u255A', br: '\u255D', h: '\u2550', v: '\u2551' },
  rounded: { tl: '\u256D', tr: '\u256E', bl: '\u2570', br: '\u256F', h: '\u2500', v: '\u2502' },
};

export class Border implements Component {
  constructor(
    private readonly child: Component,
    private readonly style: BorderStyle = 'rounded',
    private readonly title?: string,
  ) {}

  render(width: number, height: number): string[] {
    const c = CHARS[this.style];
    const innerWidth = Math.max(0, width - 2);
    const innerHeight = Math.max(0, height - 2);
    const childLines = this.child.render(innerWidth, innerHeight);

    const titleStr = this.title ? ` ${this.title} ` : '';
    const hPad = Math.max(0, innerWidth - titleStr.length);
    const topFill = c.h.repeat(Math.floor(hPad / 2)) + titleStr + c.h.repeat(Math.ceil(hPad / 2));
    const top = c.tl + topFill.slice(0, innerWidth) + c.tr;

    const middle = childLines.map(line => {
      const padded = padEndAnsi(line, innerWidth);
      return c.v + padded + c.v;
    });

    const bottom = c.bl + c.h.repeat(innerWidth) + c.br;

    return [top, ...middle, bottom];
  }
}
