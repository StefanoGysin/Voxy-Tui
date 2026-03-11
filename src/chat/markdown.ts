import { marked } from 'marked';
import type { Token, Tokens } from 'marked';
import type { Component } from '../core/component';
import { RESET, BOLD, ITALIC, DIM, UNDERLINE,
         FG_BLUE, FG_CYAN, FG_GREEN, FG_YELLOW, FG_GRAY,
         STRIKETHROUGH } from '../core/ansi';
import { wrapText } from '../utils/wrap';
import { highlightCode } from './code-block';

export class Markdown implements Component {
  private rawText = '';
  private isComplete = false;

  setContent(text: string): void {
    this.rawText = text;
    this.isComplete = false;
  }

  finalize(): void {
    this.isComplete = true;
  }

  render(width: number, _height: number): string[] {
    if (!this.rawText) return [];

    let toRender: string;
    let pending: string;

    if (this.isComplete) {
      toRender = this.rawText;
      pending  = '';
    } else {
      const lastNN = this.rawText.lastIndexOf('\n\n');
      if (lastNN === -1) {
        return wrapText(this.rawText, width);
      }
      toRender = this.rawText.slice(0, lastNN);
      pending  = this.rawText.slice(lastNN + 2);
    }

    const tokens = marked.lexer(toRender);
    const finalLines = tokens.flatMap(t => this.renderToken(t, width));
    const pendingLines = pending ? wrapText(pending, width) : [];

    return [...finalLines, ...pendingLines];
  }

  private renderToken(token: Token, width: number): string[] {
    switch (token.type) {
      case 'heading': {
        const t = token as Tokens.Heading;
        const color = t.depth === 1 ? `${BOLD}${FG_GREEN}`
                    : t.depth === 2 ? BOLD
                    : FG_GREEN;
        const prefix = '#'.repeat(t.depth) + ' ';
        const text = this.renderInline(t.tokens ?? []);
        return [`${color}${prefix}${text}${RESET}`, ''];
      }

      case 'paragraph': {
        const t = token as Tokens.Paragraph;
        const text = this.renderInline(t.tokens ?? []);
        return [...wrapText(text, width), ''];
      }

      case 'code': {
        const t = token as Tokens.Code;
        const lines: string[] = [];
        if (t.lang) {
          lines.push(`${FG_GRAY}── ${t.lang} ──${RESET}`);
        }
        const highlighted = highlightCode(t.text, t.lang ?? '');
        for (const line of highlighted.split('\n')) {
          lines.push(`  ${line}`);
        }
        lines.push('');
        return lines;
      }

      case 'blockquote': {
        const t = token as Tokens.Blockquote;
        const inner = (t.tokens ?? []).flatMap(inner => this.renderToken(inner, Math.max(1, width - 2)));
        return inner.map(l => `${FG_GRAY}│${RESET} ${l}`);
      }

      case 'list': {
        const t = token as Tokens.List;
        const lines: string[] = [];
        t.items.forEach((item, idx) => {
          const bullet = t.ordered ? `${FG_YELLOW}${idx + 1}.${RESET}` : `${FG_YELLOW}•${RESET}`;
          const inlineTokens = (item.tokens[0] as Tokens.Text)?.tokens ?? [];
          const text = this.renderInline(inlineTokens);
          const wrapped = wrapText(`${bullet} ${text}`, width);
          lines.push(...wrapped);
        });
        lines.push('');
        return lines;
      }

      case 'hr':
        return [`${FG_GRAY}${'─'.repeat(width)}${RESET}`, ''];

      case 'space':
        return [''];

      default:
        if ('text' in token && typeof token.text === 'string') {
          return wrapText(token.text, width);
        }
        return [];
    }
  }

  private renderInline(tokens: Token[]): string {
    return tokens.map(token => {
      switch (token.type) {
        case 'strong': {
          const t = token as Tokens.Strong;
          return `${BOLD}${this.renderInline(t.tokens ?? [])}${RESET}`;
        }
        case 'em': {
          const t = token as Tokens.Em;
          return `${ITALIC}${this.renderInline(t.tokens ?? [])}${RESET}`;
        }
        case 'codespan': {
          const t = token as Tokens.Codespan;
          return `${FG_CYAN}${t.text}${RESET}`;
        }
        case 'del': {
          const t = token as Tokens.Del;
          return `${STRIKETHROUGH}${this.renderInline(t.tokens ?? [])}${RESET}`;
        }
        case 'link': {
          const t = token as Tokens.Link;
          return `${UNDERLINE}${FG_BLUE}${t.text}${RESET}`;
        }
        case 'text': {
          const t = token as Tokens.Text;
          if (t.tokens && t.tokens.length > 0) {
            return this.renderInline(t.tokens);
          }
          return t.text;
        }
        default:
          return 'raw' in token ? String((token as { raw: string }).raw) : '';
      }
    }).join('');
  }
}
