import type { Component, KeyEvent } from '../core/component';
import { TextInput, type TextInputOptions } from '../components/text-input';
import { Dropdown } from '../components/dropdown';
import type { DropdownOption } from '../components/dropdown';
import { FG_GRAY, RESET } from '../core/ansi';

export interface InputBarOptions extends TextInputOptions {
  separatorChar?: string;
  maxCompletions?: number;
}

export class InputBar implements Component {
  focusable = true;

  private readonly separatorChar: string;
  private readonly input: TextInput;
  private readonly dropdown: Dropdown;
  private history: string[] = [];
  private historyIndex = -1;
  private savedDraft = '';
  private programmaticChange = false;

  onSubmit?: (text: string) => void;
  onChange?: (text: string) => void;
  onComplete?: (option: DropdownOption) => void;

  constructor(options: InputBarOptions = {}) {
    const { separatorChar = '─', maxCompletions = 8, ...inputOptions } = options;
    this.separatorChar = separatorChar;
    this.dropdown = new Dropdown({ maxVisible: maxCompletions });
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
    this.input.onChange = (text) => {
      if (!this.programmaticChange) this.onChange?.(text);
    };
  }

  getValue(): string {
    return this.input.getValue();
  }

  /** Define o valor atual do input programaticamente. */
  setValue(text: string): void {
    this.input.setValue(text);
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

  /**
   * Define as opções de completion.
   * Se options.length > 0: mostra o dropdown.
   * Se options.length === 0: oculta o dropdown.
   */
  setCompletions(options: DropdownOption[]): void {
    this.dropdown.setOptions(options);
    if (options.length > 0) {
      this.dropdown.show();
    } else {
      this.dropdown.hide();
    }
  }

  /** Oculta e limpa as completions. */
  clearCompletions(): void {
    this.dropdown.hide();
    this.dropdown.setOptions([]);
  }

  /** Passa texto de filtro ao dropdown (filtro case-insensitive nas labels). */
  setCompletionFilter(text: string): void {
    this.dropdown.setFilter(text);
  }

  /** Retorna true se o dropdown de completions está visível. */
  isCompletionVisible(): boolean {
    return this.dropdown.isVisible();
  }

  handleKey(event: KeyEvent): boolean {
    const { key } = event;

    // === Dropdown visível: interceptar teclas de navegação ===
    if (this.dropdown.isVisible()) {
      // ↑/↓ navegam o dropdown (não o histórico)
      if (key === 'up' || key === 'down') {
        return this.dropdown.handleKey(event);
      }
      // Esc: fechar dropdown
      if (key === 'escape') {
        this.dropdown.hide();
        return true;
      }
      // Enter ou Tab: confirmar completion (se houver seleção)
      if (key === 'enter' || key === 'tab') {
        const selected = this.dropdown.getSelected();
        if (selected !== null) {
          this.onComplete?.(selected);
          this.dropdown.hide();
          return true;
        }
        // Lista vazia (nenhum resultado) → Tab absorvido, Enter cai para TextInput
        if (key === 'tab') return true;
        // Enter com lista vazia → deixar cair para lógica normal (submit)
      }
      // Qualquer outra tecla: passar para TextInput normalmente
    }

    // === Histórico: ↓ quando histórico ativo ===
    if (key === 'down' && this.historyIndex !== -1) {
      if (this.historyIndex < this.history.length - 1) {
        this.historyIndex++;
        this.programmaticChange = true;
        this.input.setValue(this.history[this.historyIndex]);
        this.programmaticChange = false;
      } else {
        this.historyIndex = -1;
        this.programmaticChange = true;
        this.input.setValue(this.savedDraft);
        this.programmaticChange = false;
      }
      return true;
    }

    // === TextInput ===
    if (this.input.handleKey(event)) return true;

    // === Histórico: ↑ não consumido pelo TextInput (cursor em row 0) ===
    // Só ativa quando dropdown está oculto (se estivesse visível, ↑ já foi tratado acima)
    if (key === 'up' && this.history.length > 0) {
      if (this.historyIndex === -1) {
        this.savedDraft = this.input.getValue();
        this.historyIndex = this.history.length - 1;
      } else if (this.historyIndex > 0) {
        this.historyIndex--;
      }
      this.programmaticChange = true;
      this.input.setValue(this.history[this.historyIndex]);
      this.programmaticChange = false;
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
    return this.input.minHeight() + 1 + this.dropdown.visibleLineCount();
  }

  render(width: number, height: number): string[] {
    const dropdownLines = this.dropdown.render(width, height);
    const separator = `${FG_GRAY}${this.separatorChar.repeat(width)}${RESET}`;
    const inputLines = this.input.render(width, Math.max(1, height - 1 - dropdownLines.length));
    return [...dropdownLines, separator, ...inputLines];
  }
}
