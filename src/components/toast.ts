import type { Component } from '../core/component';
import { RESET, BOLD, DIM, FG_WHITE, FG_BLACK } from '../core/ansi';
import { theme } from '../core/theme';
import { truncate } from '../utils/truncate';

export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'mode';

export interface ToastOptions {
  type: ToastType;
  label: string;
  message?: string;
  duration?: number;
  icon?: string;
}

interface ToastEntry {
  id: string;
  options: ToastOptions;
  timer?: ReturnType<typeof setTimeout>;
}

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 3000;
const LEFT_PADDING = '  ';

const TYPE_CONFIG: Record<ToastType, { bg: string; fg: string; icon: string }> = {
  mode:    { bg: theme.toastModeBg,    fg: `${FG_WHITE}${BOLD}`, icon: '⚡' },
  success: { bg: theme.toastSuccessBg, fg: `${FG_WHITE}${BOLD}`, icon: '✓' },
  warning: { bg: theme.toastWarningBg, fg: `${FG_BLACK}${BOLD}`, icon: '⚠' },
  error:   { bg: theme.toastErrorBg,   fg: `${FG_WHITE}${BOLD}`, icon: '✗' },
  info:    { bg: theme.toastInfoBg,    fg: `${FG_WHITE}${BOLD}`, icon: 'ℹ' },
};

export class Toast implements Component {
  private entries: ToastEntry[] = [];
  private nextId = 1;
  onUpdate?: () => void;

  show(options: ToastOptions): string {
    const id = `toast-${this.nextId++}`;
    const duration = options.duration ?? DEFAULT_DURATION;

    const entry: ToastEntry = { id, options };

    if (duration > 0) {
      entry.timer = setTimeout(() => {
        this.removeEntry(id);
        this.onUpdate?.();
      }, duration);
    }

    this.entries.push(entry);

    // FIFO: remove oldest if over max
    if (this.entries.length > MAX_VISIBLE) {
      const oldest = this.entries.shift()!;
      if (oldest.timer !== undefined) clearTimeout(oldest.timer);
    }

    this.onUpdate?.();
    return id;
  }

  dismiss(id?: string): void {
    if (id !== undefined) {
      this.removeEntry(id);
    } else if (this.entries.length > 0) {
      const oldest = this.entries.shift()!;
      if (oldest.timer !== undefined) clearTimeout(oldest.timer);
    }
    this.onUpdate?.();
  }

  clear(): void {
    for (const entry of this.entries) {
      if (entry.timer !== undefined) clearTimeout(entry.timer);
    }
    this.entries = [];
  }

  dispose(): void {
    this.clear();
  }

  count(): number {
    return this.entries.length;
  }

  visibleLineCount(): number {
    return this.entries.length;
  }

  minHeight(): number {
    return this.entries.length > 0 ? this.entries.length : 0;
  }

  render(width: number, _height: number): string[] {
    if (this.entries.length === 0) return [];
    return this.entries.map(entry => this.renderEntry(entry, width));
  }

  private renderEntry(entry: ToastEntry, width: number): string {
    const config = TYPE_CONFIG[entry.options.type];
    const icon = entry.options.icon ?? config.icon;
    const tagText = ` ${icon} ${entry.options.label} `;
    const tag = `${config.bg}${config.fg}${tagText}${RESET}`;

    const message = entry.options.message;
    if (!message) {
      return `${LEFT_PADDING}${tag}`;
    }

    // tagText visual width + left padding (2) + separator (2)
    const tagVisualWidth = tagText.length;
    const maxMessageWidth = Math.max(0, width - 2 - tagVisualWidth - 2);
    const truncatedMessage = truncate(message, maxMessageWidth);
    return `${LEFT_PADDING}${tag}  ${DIM}${truncatedMessage}${RESET}`;
  }

  private removeEntry(id: string): void {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return;
    const entry = this.entries[idx];
    if (entry.timer !== undefined) clearTimeout(entry.timer);
    this.entries.splice(idx, 1);
  }
}
