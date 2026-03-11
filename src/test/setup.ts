import type { Terminal } from '../core/terminal';

/**
 * MockTerminal for testing — captures all write output.
 */
export class MockTerminal implements Terminal {
  public output: string[] = [];
  public columns: number;
  public rows: number;

  constructor(columns: number = 80, rows: number = 24) {
    this.columns = columns;
    this.rows = rows;
  }

  write(data: string): void {
    this.output.push(data);
  }

  getSize(): { columns: number; rows: number } {
    return { columns: this.columns, rows: this.rows };
  }

  reset(): void {
    this.output = [];
  }

  getOutput(): string {
    return this.output.join('');
  }
}
