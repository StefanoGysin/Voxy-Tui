export interface Terminal {
  write(data: string): void;
  getSize(): { columns: number; rows: number };
}

export class ProcessTerminal implements Terminal {
  write(data: string): void {
    process.stdout.write(data);
  }
  getSize(): { columns: number; rows: number } {
    return {
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
    };
  }
}
