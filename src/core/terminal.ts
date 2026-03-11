export interface Terminal {
  write(data: string): void;
  getSize(): { columns: number; rows: number };
}
