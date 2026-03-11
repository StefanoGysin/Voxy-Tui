import { measureWidth } from './width';
import { stripAnsi } from './strip-ansi';

export function truncate(text: string, maxWidth: number, ellipsis = '\u2026'): string {
  const visual = measureWidth(stripAnsi(text));
  if (visual <= maxWidth) return text;
  const ellipsisWidth = measureWidth(ellipsis);
  const target = maxWidth - ellipsisWidth;
  if (target <= 0) return ellipsis;
  let current = 0;
  let result = '';
  for (const char of stripAnsi(text)) {
    const w = measureWidth(char);
    if (current + w > target) break;
    result += char;
    current += w;
  }
  return result + ellipsis;
}
