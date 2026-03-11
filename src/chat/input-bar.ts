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

  onSubmit?: (text: string) => void;
  onChange?: (text: string) => void;

  constructor(options: InputBarOptions = {}) {
    const { separatorChar = '─', ...inputOptions } = options;
    this.separatorChar = separatorChar;
    this.input = new TextInput(inputOptions);
    this.input.onSubmit = (text) => this.onSubmit?.(text);
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
    return this.input.handleKey(event);
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
