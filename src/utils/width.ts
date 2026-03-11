import stringWidth from 'string-width';

export { stringWidth };

export function measureWidth(text: string): number {
  return stringWidth(text);
}
