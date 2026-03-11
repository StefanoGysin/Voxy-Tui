export const ANSI_REGEX: RegExp = /\x1b\[[0-9;]*[mGKHFJABCDsuhl?]|\x1b[78]/g;

export function stripAnsi(text: string): string {
  return text.replace(ANSI_REGEX, '');
}
