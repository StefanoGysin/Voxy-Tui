import type { Component, KeyEvent } from '../core/component';
import { BOLD, DIM, FG_WHITE, RESET } from '../core/ansi';
import { Border } from './border';
import { wrapText } from '../utils/wrap';
import { padEndAnsi } from '../utils/width';

export interface DialogConfig {
  title?: string;
  message: string;
  buttons: string[];
  defaultButton?: number;
}

export class Dialog implements Component {
  focusable = true;
  onSelect?: (button: string, index: number) => void;

  private config: DialogConfig;
  private selectedButton: number;

  constructor(config: DialogConfig) {
    this.config = config;
    this.selectedButton = config.defaultButton ?? 0;
  }

  update(partial: Partial<DialogConfig>): void {
    const buttonsChanged = partial.buttons !== undefined;
    this.config = { ...this.config, ...partial };
    if (buttonsChanged) {
      this.selectedButton = this.config.defaultButton ?? 0;
    }
  }

  getSelectedButton(): number {
    return this.selectedButton;
  }

  handleKey(event: KeyEvent): boolean {
    switch (event.key) {
      case 'left':
        this.selectedButton = Math.max(0, this.selectedButton - 1);
        return true;
      case 'right':
        this.selectedButton = Math.min(this.config.buttons.length - 1, this.selectedButton + 1);
        return true;
      case 'tab':
        if (event.shift) {
          this.selectedButton = Math.max(0, this.selectedButton - 1);
        } else {
          this.selectedButton = Math.min(this.config.buttons.length - 1, this.selectedButton + 1);
        }
        return true;
      case 'up':
      case 'down':
        return true;
      case 'enter':
        this.onSelect?.(this.config.buttons[this.selectedButton]!, this.selectedButton);
        return true;
      case 'escape':
        this.onSelect?.(this.config.buttons[0]!, 0);
        return true;
      default:
        return false;
    }
  }

  render(width: number, _height: number): string[] {
    const innerWidth = Math.max(0, width - 2);
    const messageLines = wrapText(this.config.message, innerWidth);

    const buttonParts = this.config.buttons.map((label, i) => {
      if (i === this.selectedButton) {
        return `${BOLD}${FG_WHITE}[ ${label} ]${RESET}`;
      }
      return `${DIM}  ${label}  ${RESET}`;
    });
    const buttonsStr = padEndAnsi(buttonParts.join(' '), innerWidth);

    const inner: Component = {
      render: () => [...messageLines, '', buttonsStr],
    };

    return new Border(inner, 'rounded', this.config.title).render(width, 999);
  }
}
