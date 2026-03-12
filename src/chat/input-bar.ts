import type { Component, KeyEvent } from '../core/component';
import { TextInput, type TextInputOptions } from '../components/text-input';
import { FG_GRAY, RESET } from '../core/ansi';

export interface InputBarOptions extends TextInputOptions {
  separatorChar?: string;
}

export class InputBar implements Component {
  focusable = true;

  private readonly separatorChar: string;
  private readonly input: TextInput;
  private history: string[] = [];
  private historyIndex = -1;
  private savedDraft = '';

  onSubmit?: (text: string) => void;
  onChange?: (text: string) => void;

  constructor(options: InputBarOptions = {}) {
    const { separatorChar = '─', ...inputOptions } = options;
    this.separatorChar = separatorChar;
    this.input = new TextInput(inputOptions);
    this.input.onSubmit = (text) => {
      if (text.trim()) {
        // Evitar duplicatas consecutivas
        if (this.history.length === 0 || this.history[this.history.length - 1] !== text) {
          this.history.push(text);
        }
      }
      this.historyIndex = -1;
      this.savedDraft = '';
      this.onSubmit?.(text);
    };
    this.input.onChange = (text) => this.onChange?.(text);
  }

  getValue(): string {
    return this.input.getValue();
  }

  clear(): void {
    this.input.clear();
  }

  onFocus(): void {
    this.input.onFocus();
  }

  onBlur(): void {
    this.input.onBlur();
  }

  handleKey(event: KeyEvent): boolean {
    const { key } = event;

    // ↓ com histórico ativo: avançar ou restaurar rascunho
    if (key === 'down' && this.historyIndex !== -1) {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.input.setValue(this.history[this.historyIndex]);
      } else {
        this.historyIndex = -1;
        this.input.setValue(this.savedDraft);
      }
      return true;
    }

    // Passar para TextInput primeiro
    if (this.input.handleKey(event)) return true;

    // ↑ não consumido por TextInput (cursor estava em row 0):
    // navegar histórico para trás
    if (key === 'up' && this.history.length > 0) {
      if (this.historyIndex === -1) {
        this.savedDraft = this.input.getValue();
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.input.setValue(this.history[this.historyIndex]);
      return true;
    }

    return false;
  }

  /** Retorna uma cópia do histórico (útil para persistência e testes). */
  getHistory(): string[] { return [...this.history]; }

  /** Carrega histórico (ex: de sessão anterior). */
  setHistory(entries: string[]): void {
    this.history = [...entries];
    this.historyIndex = -1;
    this.savedDraft = '';
  }

  /** Limpa o histórico. */
  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
    this.savedDraft = '';
  }

  minHeight(): number {
    return this.input.minHeight() + 1;
  }

  render(width: number, height: number): string[] {
    const separator = `${FG_GRAY}${this.separatorChar.repeat(width)}${RESET}`;
    const inputLines = this.input.render(width, Math.max(1, height - 1));
    return [separator, ...inputLines];
  }
}
