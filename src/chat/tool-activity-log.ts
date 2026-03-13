import type { Component } from '../core/component';
import { RESET, BOLD, FG_CYAN, FG_GREEN, FG_GRAY, FG_RED, FG_YELLOW } from '../core/ansi';
import { BRAILLE_FRAMES, FRAME_INTERVAL_MS } from '../components/spinner';
import { truncate } from '../utils/truncate';
import type { ToolStatus } from './tool-call';

interface ToolEntry {
  id: string;
  name: string;
  label: string;
  status: ToolStatus;
}

export interface ToolActivityLogOptions {
  /** Máximo de entradas visíveis (mais antigas são truncadas). Default: 10 */
  maxVisible?: number;
}

export class ToolActivityLog implements Component {
  private entries: ToolEntry[] = [];
  private frameIndex = 0;
  private timer?: ReturnType<typeof setInterval>;
  private readonly maxVisible: number;
  onUpdate?: () => void;

  constructor(options: ToolActivityLogOptions = {}) {
    this.maxVisible = options.maxVisible ?? 10;
  }

  /**
   * Adiciona uma tool call como 'running'.
   * @param id     Identificador único (ex: UUID da tool call)
   * @param name   Nome da tool (ex: 'read_file', 'bash')
   * @param label  Descrição curta (ex: path do arquivo, comando)
   */
  addTool(id: string, name: string, label = ''): void {
    this.entries.push({ id, name, label, status: 'running' });
    this.ensureTimer();
  }

  /**
   * Atualiza o status de uma entry existente.
   * Se não houver mais nenhuma entry 'running', para o timer.
   */
  updateTool(id: string, status: ToolStatus, label?: string): void {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return;
    entry.status = status;
    if (label !== undefined) entry.label = label;
    if (!this.entries.some(e => e.status === 'running')) {
      this.stopTimer();
    }
  }

  /** Remove todas as entradas e para o timer. */
  clear(): void {
    this.entries = [];
    this.stopTimer();
  }

  dispose(): void { this.stopTimer(); }

  /**
   * Número de linhas que render() vai retornar sem chamar render().
   * Usado por ChatLayout para calcular a altura antes de renderizar.
   * 0 quando não há entradas.
   */
  visibleLineCount(): number {
    return Math.min(this.entries.length, this.maxVisible);
  }

  render(width: number, _height: number): string[] {
    const visible = this.entries.slice(-this.maxVisible);
    return visible.map(entry => this.renderEntry(entry, width));
  }

  private renderEntry(entry: ToolEntry, width: number): string {
    const statusIcon = this.statusIcon(entry.status);
    const name = `${FG_CYAN}${BOLD}${entry.name}${RESET}`;
    const maxLabelWidth = Math.max(0, width - entry.name.length - 6);
    const label = entry.label
      ? ` ${FG_GRAY}${truncate(entry.label, maxLabelWidth)}${RESET}`
      : '';
    return `${statusIcon} ${name}${label}`;
  }

  private statusIcon(status: ToolStatus): string {
    switch (status) {
      case 'running': {
        const frame = BRAILLE_FRAMES[this.frameIndex % BRAILLE_FRAMES.length];
        return `${FG_YELLOW}${frame}${RESET}`;
      }
      case 'done':  return `${FG_GREEN}✓${RESET}`;
      case 'error': return `${FG_RED}✗${RESET}`;
    }
  }

  private ensureTimer(): void {
    if (this.timer !== undefined) return;
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % BRAILLE_FRAMES.length;
      this.onUpdate?.();
    }, FRAME_INTERVAL_MS);
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
