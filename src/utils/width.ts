import stringWidth from 'string-width';
import { stripAnsi } from './strip-ansi';

export { stringWidth };

export function measureWidth(text: string): number {
  return stringWidth(text);
}

/**
 * Pad a string (que pode conter ANSI codes) até targetWidth colunas visuais.
 * Usa measureWidth(stripAnsi(line)) para medir a largura real.
 */
export function padEndAnsi(line: string, targetWidth: number): string {
  const visual = measureWidth(stripAnsi(line));
  const padding = Math.max(0, targetWidth - visual);
  return line + ' '.repeat(padding);
}
