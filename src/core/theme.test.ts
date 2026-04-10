import { describe, expect, it } from 'bun:test';
import { theme, SELECTED_BORDER } from './theme';

describe('theme', () => {
  const expectedKeys = [
    'panelBg', 'panelHeaderBg',
    'borderFg',
    'titleFg', 'textFg', 'textDim', 'textMuted',
    'selectedBg', 'selectedFg',
    'itemFg',
    'groupLabelFg',
    'countFg',
    'dangerFg', 'dangerSelectedBg', 'dangerSelectedFg',
    'successFg',
    'warningFg',
    'diffAddFg', 'diffAddBg', 'diffDelFg', 'diffDelBg', 'diffCtxFg',
    'separatorFg',
    'hintsFg',
    'scrollbarThumbFg', 'scrollbarThumbBg',
    'scrollbarTrackFg', 'scrollbarTrackBg',
    'scrollbarSepFg',
    'toastModeBg', 'toastSuccessBg', 'toastWarningBg', 'toastErrorBg', 'toastInfoBg',
    'statusStreamingFg', 'statusErrorFg', 'statusIdleFg', 'statusModelFg', 'statusTokensFg',
    'statusContextNormalFg', 'statusContextWarningFg', 'statusContextDangerFg',
    'statusThinkingFg', 'statusThinkingDotFg', 'statusSeparatorFg',
    'toolMsgBg', 'userMsgBg', 'assistantMsgBg', 'userTextFg', 'userTextStyle',
    'toolNameFg', 'toolRunningFg', 'toolDoneFg', 'toolErrorFg', 'toolLabelFg',
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
    for (const key of expectedKeys) {
      const value = theme[key as keyof typeof theme];
      expect(value).toContain('\x1b');
    }
  });

  it('SELECTED_BORDER is the ▎ character', () => {
    expect(SELECTED_BORDER).toBe('▎');
  });

  it('key semantic values exist and are strings', () => {
    expect(typeof theme.panelBg).toBe('string');
    expect(typeof theme.borderFg).toBe('string');
    expect(typeof theme.selectedFg).toBe('string');
    expect(typeof theme.titleFg).toBe('string');
  });
});
