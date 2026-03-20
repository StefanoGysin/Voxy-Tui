import { describe, expect, it } from 'bun:test';
import { theme } from './theme';

describe('theme', () => {
  const expectedKeys = [
    'panelBg', 'panelHeaderBg',
    'borderFg',
    'titleFg', 'textFg', 'textDim', 'textMuted',
    'selectedBg', 'selectedFg', 'selectedBorder',
    'itemFg',
    'groupLabelFg',
    'countFg',
    'dangerFg', 'dangerSelectedBg', 'dangerSelectedFg',
    'successFg',
    'warningFg',
    'diffAddFg', 'diffAddBg', 'diffDelFg', 'diffDelBg', 'diffCtxFg',
    'separatorFg',
    'hintsFg',
  ];

  it('exports all expected keys', () => {
    for (const key of expectedKeys) {
      expect(theme).toHaveProperty(key);
    }
  });

  it('has no unexpected keys', () => {
    const actual = Object.keys(theme).sort();
    const expected = [...expectedKeys].sort();
    expect(actual).toEqual(expected);
  });

  it('every value is a non-empty string', () => {
    for (const [key, value] of Object.entries(theme)) {
      expect(typeof value).toBe('string');
      expect((value as string).length).toBeGreaterThan(0);
    }
  });

  it('ANSI values contain escape sequences', () => {
    const ansiKeys = expectedKeys.filter(k => k !== 'selectedBorder');
    for (const key of ansiKeys) {
      const value = theme[key as keyof typeof theme];
      expect(value).toContain('\x1b');
    }
  });

  it('key semantic values exist and are strings', () => {
    expect(typeof theme.panelBg).toBe('string');
    expect(typeof theme.borderFg).toBe('string');
    expect(typeof theme.selectedFg).toBe('string');
    expect(typeof theme.titleFg).toBe('string');
  });
});
