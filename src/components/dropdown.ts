import type { Component, KeyEvent } from '../core/component';
import { BOLD, DIM, FG_GRAY, FG_WHITE, RESET } from '../core/ansi';
import { padEndAnsi } from '../utils/width';

export interface DropdownOption {
  label: string;
  value: string;
  description?: string;
}

export interface DropdownOptions {
  maxVisible?: number;
}

export class Dropdown implements Component {
  focusable = true;
  onSelect?: (option: DropdownOption) => void;

  private allOptions: DropdownOption[] = [];
  private filteredOptions: DropdownOption[] = [];
  private filter = '';
  private selectedIndex = 0;
  private scrollStart = 0;
  private visible = false;
  private readonly maxVisible: number;

  constructor(options?: DropdownOptions) {
    this.maxVisible = options?.maxVisible ?? 8;
  }

  setOptions(allOptions: DropdownOption[]): void {
    this.allOptions = allOptions;
    this.selectedIndex = 0;
    this.scrollStart = 0;
    this.applyFilter();
  }

  setFilter(text: string): void {
    const prev = this.filter;
    this.filter = text;
    if (prev !== text) {
      this.selectedIndex = 0;
      this.scrollStart = 0;
      this.applyFilter();
    }
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  getSelected(): DropdownOption | null {
    if (!this.visible || this.filteredOptions.length === 0) return null;
    return this.filteredOptions[this.selectedIndex] ?? null;
  }

  getFilteredOptions(): DropdownOption[] {
    return this.filteredOptions;
  }

  /** Número de linhas que render() retornaria no estado atual. */
  visibleLineCount(): number {
    if (!this.visible) return 0;
    if (this.filteredOptions.length === 0) return 1;
    return Math.min(this.filteredOptions.length, this.maxVisible);
  }

  handleKey(event: KeyEvent): boolean {
    if (!this.visible) return false;

    switch (event.key) {
      case 'up':
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.adjustScroll();
        return true;
      case 'down':
        this.selectedIndex = Math.min(this.filteredOptions.length - 1, this.selectedIndex + 1);
        this.adjustScroll();
        return true;
      case 'enter': {
        const selected = this.getSelected();
        if (selected) {
          this.onSelect?.(selected);
          this.hide();
        }
        return true;
      }
      case 'escape':
        this.hide();
        return true;
      default:
        return false;
    }
  }

  render(width: number, _height: number): string[] {
    if (!this.visible) return [];

    if (this.filteredOptions.length === 0) {
      return [padEndAnsi(`${DIM}  (nenhum resultado)${RESET}`, width)];
    }

    this.adjustScroll();
    const end = Math.min(this.scrollStart + this.maxVisible, this.filteredOptions.length);
    const lines: string[] = [];

    for (let i = this.scrollStart; i < end; i++) {
      const opt = this.filteredOptions[i]!;
      const isSelected = i === this.selectedIndex;
      const desc = opt.description ? ` ${DIM}${FG_GRAY}${opt.description}${RESET}` : '';

      let line: string;
      if (isSelected) {
        line = `> ${BOLD}${FG_WHITE}${opt.label}${RESET}${desc}`;
      } else {
        line = `  ${opt.label}${desc}`;
      }

      lines.push(padEndAnsi(line, width));
    }

    return lines;
  }

  private applyFilter(): void {
    const lower = this.filter.toLowerCase();
    this.filteredOptions = lower
      ? this.allOptions.filter(o => o.label.toLowerCase().includes(lower))
      : [...this.allOptions];
  }

  private adjustScroll(): void {
    if (this.selectedIndex < this.scrollStart) {
      this.scrollStart = this.selectedIndex;
    }
    if (this.selectedIndex >= this.scrollStart + this.maxVisible) {
      this.scrollStart = this.selectedIndex - this.maxVisible + 1;
    }
  }
}
