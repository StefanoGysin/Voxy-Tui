import type { Component, KeyEvent } from '../core/component';
import { RESET, BOLD, FG_CYAN } from '../core/ansi';
import { measureWidth } from '../utils/width';
import { stripAnsi } from '../utils/strip-ansi';

interface CursorSnapshot {
  lines: string[];
  row: number;
  col: number;
}

export interface TextInputOptions {
  /** Prefixo visual da primeira linha. Default: '> ' */
  prompt?: string;
  /** Prefixo visual das linhas de continuação. Default: '  ' */
  continuationPrompt?: string;
  /** Enter = submit. Shift+Enter = newline. Default: true */
  submitOnEnter?: boolean;
  /** Placeholder quando vazio. */
  placeholder?: string;
}

export class TextInput implements Component {
  focusable = true;

  private lines: string[] = [''];
  private cursorRow = 0;
  private cursorCol = 0;
  private undoStack: CursorSnapshot[] = [];
  private killRing: string[] = [];
  private focused = false;
  private readonly options: Required<TextInputOptions>;

  onSubmit?: (text: string) => void;
  onChange?: (text: string) => void;

  constructor(options: TextInputOptions = {}) {
    this.options = {
      prompt: options.prompt ?? '> ',
      continuationPrompt: options.continuationPrompt ?? '  ',
      submitOnEnter: options.submitOnEnter ?? true,
      placeholder: options.placeholder ?? '',
    };
  }

  // ── Estado ────────────────────────────────────────────────────────────────

  getValue(): string { return this.lines.join('\n'); }

  setValue(text: string): void {
    this.pushUndo();
    this.lines = text.split('\n');
    if (this.lines.length === 0) this.lines = [''];
    this.cursorRow = this.lines.length - 1;
    this.cursorCol = this.lines[this.cursorRow].length;
    this.onChange?.(this.getValue());
  }

  clear(): void {
    this.lines = [''];
    this.cursorRow = 0;
    this.cursorCol = 0;
    this.undoStack = [];
    this.killRing = [];
  }

  // ── Focus ─────────────────────────────────────────────────────────────────

  onFocus(): void { this.focused = true; }
  onBlur(): void { this.focused = false; }
  minHeight(): number { return this.lines.length; }

  // ── Undo ──────────────────────────────────────────────────────────────────

  private pushUndo(): void {
    this.undoStack.push({
      lines: [...this.lines],
      row: this.cursorRow,
      col: this.cursorCol,
    });
    if (this.undoStack.length > 100) this.undoStack.shift();
  }

  private popUndo(): void {
    const snap = this.undoStack.pop();
    if (!snap) return;
    this.lines = snap.lines;
    this.cursorRow = snap.row;
    this.cursorCol = snap.col;
  }

  // ── Edição ────────────────────────────────────────────────────────────────

  private insertText(text: string): void {
    this.pushUndo();
    const line = this.lines[this.cursorRow];
    this.lines[this.cursorRow] =
      line.slice(0, this.cursorCol) + text + line.slice(this.cursorCol);
    this.cursorCol += text.length;
    this.onChange?.(this.getValue());
  }

  private insertNewline(): void {
    this.pushUndo();
    const line = this.lines[this.cursorRow];
    const before = line.slice(0, this.cursorCol);
    const after = line.slice(this.cursorCol);
    this.lines[this.cursorRow] = before;
    this.lines.splice(this.cursorRow + 1, 0, after);
    this.cursorRow++;
    this.cursorCol = 0;
    this.onChange?.(this.getValue());
  }

  private deleteBackward(): void {
    if (this.cursorCol > 0) {
      this.pushUndo();
      const line = this.lines[this.cursorRow];
      this.lines[this.cursorRow] =
        line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
      this.cursorCol--;
      this.onChange?.(this.getValue());
    } else if (this.cursorRow > 0) {
      // Merge com linha anterior
      this.pushUndo();
      const prev = this.lines[this.cursorRow - 1];
      this.cursorCol = prev.length;
      this.lines[this.cursorRow - 1] = prev + this.lines[this.cursorRow];
      this.lines.splice(this.cursorRow, 1);
      this.cursorRow--;
      this.onChange?.(this.getValue());
    }
  }

  private deleteForward(): void {
    const line = this.lines[this.cursorRow];
    if (this.cursorCol < line.length) {
      this.pushUndo();
      this.lines[this.cursorRow] =
        line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
      this.onChange?.(this.getValue());
    } else if (this.cursorRow < this.lines.length - 1) {
      this.pushUndo();
      this.lines[this.cursorRow] += this.lines[this.cursorRow + 1];
      this.lines.splice(this.cursorRow + 1, 1);
      this.onChange?.(this.getValue());
    }
  }

  // ── Kill ring (Ctrl+K / Ctrl+Y) ───────────────────────────────────────────

  private killToEndOfLine(): void {
    const line = this.lines[this.cursorRow];
    const killed = line.slice(this.cursorCol);
    if (killed.length > 0) {
      this.pushUndo();
      this.killRing.push(killed);
      if (this.killRing.length > 20) this.killRing.shift();
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol);
      this.onChange?.(this.getValue());
    }
  }

  private yank(): void {
    if (this.killRing.length === 0) return;
    this.insertText(this.killRing[this.killRing.length - 1]);
  }

  // ── Movimento de cursor ───────────────────────────────────────────────────

  private moveLeft(): void {
    if (this.cursorCol > 0) {
      this.cursorCol--;
    } else if (this.cursorRow > 0) {
      this.cursorRow--;
      this.cursorCol = this.lines[this.cursorRow].length;
    }
  }

  private moveRight(): void {
    const line = this.lines[this.cursorRow];
    if (this.cursorCol < line.length) {
      this.cursorCol++;
    } else if (this.cursorRow < this.lines.length - 1) {
      this.cursorRow++;
      this.cursorCol = 0;
    }
  }

  private moveWordLeft(): void {
    if (this.cursorCol === 0 && this.cursorRow > 0) {
      this.cursorRow--;
      this.cursorCol = this.lines[this.cursorRow].length;
      return;
    }
    const line = this.lines[this.cursorRow];
    let pos = this.cursorCol - 1;
    while (pos > 0 && line[pos] === ' ') pos--;
    while (pos > 0 && line[pos - 1] !== ' ') pos--;
    this.cursorCol = pos;
  }

  private moveWordRight(): void {
    const line = this.lines[this.cursorRow];
    if (this.cursorCol === line.length && this.cursorRow < this.lines.length - 1) {
      this.cursorRow++;
      this.cursorCol = 0;
      return;
    }
    let pos = this.cursorCol;
    while (pos < line.length && line[pos] !== ' ') pos++;
    while (pos < line.length && line[pos] === ' ') pos++;
    this.cursorCol = pos;
  }

  // ── handleKey ─────────────────────────────────────────────────────────────

  handleKey(event: KeyEvent): boolean {
    const { key, ctrl, shift } = event;

    // Submit: Enter (sem shift, sem ctrl)
    if (key === 'return' && !ctrl && !shift && this.options.submitOnEnter) {
      this.onSubmit?.(this.getValue());
      return true;
    }

    // Newline: Shift+Enter ou Ctrl+J
    if ((key === 'return' && shift) || (key === 'j' && ctrl)) {
      this.insertNewline();
      return true;
    }

    // Backspace
    if (key === 'backspace') { this.deleteBackward(); return true; }

    // Delete forward
    if (key === 'delete') { this.deleteForward(); return true; }

    // Ctrl+K — kill to end of line
    if (key === 'k' && ctrl) { this.killToEndOfLine(); return true; }

    // Ctrl+Y — yank
    if (key === 'y' && ctrl) { this.yank(); return true; }

    // Ctrl+Z — undo
    if (key === 'z' && ctrl) { this.popUndo(); return true; }

    // Ctrl+A — início da linha
    if (key === 'a' && ctrl) { this.cursorCol = 0; return true; }

    // Ctrl+E — fim da linha
    if (key === 'e' && ctrl) {
      this.cursorCol = this.lines[this.cursorRow].length;
      return true;
    }

    // Setas
    if (key === 'left')  { ctrl ? this.moveWordLeft()  : this.moveLeft();  return true; }
    if (key === 'right') { ctrl ? this.moveWordRight() : this.moveRight(); return true; }

    if (key === 'up' && this.cursorRow > 0) {
      this.cursorRow--;
      this.cursorCol = Math.min(this.cursorCol, this.lines[this.cursorRow].length);
      return true;
    }
    if (key === 'down' && this.cursorRow < this.lines.length - 1) {
      this.cursorRow++;
      this.cursorCol = Math.min(this.cursorCol, this.lines[this.cursorRow].length);
      return true;
    }

    // Home / End
    if (key === 'home') { this.cursorCol = 0; return true; }
    if (key === 'end') {
      this.cursorCol = this.lines[this.cursorRow].length;
      return true;
    }

    // Caractere imprimível
    if (event.raw.length === 1 && event.raw >= ' ' && !ctrl && !event.meta) {
      this.insertText(event.raw);
      return true;
    }

    return false;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render(width: number, _height: number): string[] {
    const { prompt, continuationPrompt, placeholder } = this.options;

    // Placeholder quando vazio e sem foco
    if (this.lines.length === 1 && this.lines[0] === '' && !this.focused && placeholder) {
      return [`${prompt}${FG_CYAN}${placeholder}${RESET}`];
    }

    return this.lines.map((line, i) => {
      const prefix = i === 0 ? prompt : continuationPrompt;
      const prefixWidth = measureWidth(stripAnsi(prefix));
      const available = Math.max(0, width - prefixWidth);

      if (this.focused && i === this.cursorRow) {
        return prefix + this.renderLineWithCursor(line, available);
      }
      return prefix + line;
    });
  }

  private renderLineWithCursor(line: string, _width: number): string {
    const before = line.slice(0, this.cursorCol);
    const cursorChar = line[this.cursorCol] ?? ' ';
    const after = line.slice(this.cursorCol + 1);
    // Cursor: caractere invertido (bright + underline)
    const cursor = `${BOLD}\x1b[7m${cursorChar}${RESET}`;
    return before + cursor + after;
  }
}
