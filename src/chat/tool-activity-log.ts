import type { Component } from '../core/component';
import { RESET, BOLD, FG_CYAN, FG_GREEN, FG_GRAY, FG_RED, FG_YELLOW } from '../core/ansi';
import { BRAILLE_FRAMES, FRAME_INTERVAL_MS } from '../components/spinner';
import { truncate } from '../utils/truncate';
import type { ToolStatus } from './tool-call';

const MAX_ENTRY_AGE_MS = 30_000;

interface ToolEntry {
  id: string;
  name: string;
  label: string;
  status: ToolStatus;
  addedAt: number;
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
    const existing = this.entries.find(e => e.id === id);
    if (existing) {
      existing.name = name;
      existing.label = label;
      existing.status = 'running';
      existing.addedAt = Date.now();
      this.ensureTimer();
      return;
    }
    this.entries.push({ id, name, label, status: 'running', addedAt: Date.now() });
    this.ensureTimer();
  }

  /**
   * Remove a entry imediatamente do log.
   * O activity log só mostra tools em execução — quando termina, some.
   */
  updateTool(id: string, _status: ToolStatus, _label?: string): void {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx === -1) return;
    this.entries.splice(idx, 1);
    if (!this.entries.some(e => e.status === 'running')) {
      this.stopTimer();
    }
    this.onUpdate?.();
  }

  /**
   * Remove uma entry pelo ID, se existir.
   * Safety net para forçar remoção quando updateTool não encontra
   * (ex: ID mismatch ou race condition).
   */
  removeTool(id: string): void {
    const idx = this.entries.findIndex(e => e.id === id);
    if (idx !== -1) {
      this.entries.splice(idx, 1);
      if (!this.entries.some(e => e.status === 'running')) {
        this.stopTimer();
      }
      this.onUpdate?.();
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
    // Safety net: remove entries que ficaram "fantasma" (updateTool nunca chamado)
    const now = Date.now();
    const hadEntries = this.entries.length > 0;
    this.entries = this.entries.filter(e => now - e.addedAt <= MAX_ENTRY_AGE_MS);
    if (hadEntries && this.entries.length === 0) {
      this.stopTimer();
    }

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
