import { measureWidth } from './width';
import { stripAnsi } from './strip-ansi';

export function wrapText(text: string, width: number): string[] {
  if (width <= 0) return [text];

  const result: string[] = [];

  for (const logicalLine of text.split('\n')) {
    const visualLine = stripAnsi(logicalLine);
    if (measureWidth(visualLine) <= width) {
      result.push(logicalLine);
      continue;
    }

    const words = logicalLine.split(' ');
    let currentLine = '';
    let currentWidth = 0;

    for (const word of words) {
      const wordWidth = measureWidth(stripAnsi(word));
      const spacer = currentLine ? 1 : 0;

      if (currentWidth + spacer + wordWidth > width) {
        if (currentLine) result.push(currentLine);
        if (wordWidth > width) {
          let chunk = '';
          let chunkWidth = 0;
          for (const char of stripAnsi(word)) {
            const cw = measureWidth(char);
            if (chunkWidth + cw > width) {
              result.push(chunk);
              chunk = char;
              chunkWidth = cw;
            } else {
              chunk += char;
              chunkWidth += cw;
            }
          }
          currentLine = chunk;
          currentWidth = chunkWidth;
        } else {
          currentLine = word;
          currentWidth = wordWidth;
        }
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word;
        currentWidth += spacer + wordWidth;
      }
    }

    if (currentLine) result.push(currentLine);
  }

  return result.length > 0 ? result : [''];
}
