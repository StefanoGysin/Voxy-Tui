import { bg, fg } from './ansi';

export interface Theme {
  readonly panelBg: string;
  readonly panelHeaderBg: string;
  readonly borderFg: string;
  readonly titleFg: string;
  readonly textFg: string;
  readonly textDim: string;
  readonly textMuted: string;
  readonly selectedBg: string;
  readonly selectedFg: string;
  readonly itemFg: string;
  readonly groupLabelFg: string;
  readonly countFg: string;
  readonly dangerFg: string;
  readonly dangerSelectedBg: string;
  readonly dangerSelectedFg: string;
  readonly successFg: string;
  readonly warningFg: string;
  readonly diffAddFg: string;
  readonly diffAddBg: string;
  readonly diffDelFg: string;
  readonly diffDelBg: string;
  readonly diffCtxFg: string;
  readonly separatorFg: string;
  readonly hintsFg: string;
  readonly scrollbarThumbFg: string;
  readonly scrollbarThumbBg: string;
  readonly scrollbarTrackFg: string;
  readonly scrollbarTrackBg: string;
  readonly scrollbarSepFg: string;
}

export const theme: Theme = {
  // Fundo de painéis
  panelBg: bg(12, 16, 26),
  panelHeaderBg: bg(15, 20, 30),

  // Bordas
  borderFg: fg(40, 55, 70),

  // Texto
  titleFg: fg(224, 242, 254),
  textFg: fg(201, 209, 217),
  textDim: fg(126, 143, 160),
  textMuted: fg(61, 90, 110),

  // Item selecionado
  selectedBg: bg(20, 32, 45),
  selectedFg: fg(34, 211, 238),

  // Item normal (listas)
  itemFg: fg(126, 143, 160),

  // Labels de grupo
  groupLabelFg: fg(61, 90, 110),

  // Contadores
  countFg: fg(61, 90, 110),

  // Danger
  dangerFg: fg(239, 68, 68),
  dangerSelectedBg: bg(40, 20, 20),
  dangerSelectedFg: fg(252, 165, 165),

  // Success
  successFg: fg(74, 222, 128),

  // Warning
  warningFg: fg(234, 179, 8),

  // Diff
  diffAddFg: fg(63, 185, 80),
  diffAddBg: bg(13, 27, 18),
  diffDelFg: fg(248, 81, 73),
  diffDelBg: bg(35, 15, 15),
  diffCtxFg: fg(139, 148, 158),

  // Separadores
  separatorFg: fg(61, 90, 110),

  // Footer/hints
  hintsFg: fg(61, 90, 110),

  // Scrollbar
  scrollbarThumbFg: fg(168, 168, 168),
  scrollbarThumbBg: bg(88, 88, 88),
  scrollbarTrackFg: fg(58, 58, 58),
  scrollbarTrackBg: bg(28, 28, 28),
  scrollbarSepFg: fg(48, 48, 48),
};

/** Caractere visual para borda de item selecionado (não é sequência ANSI). */
export const SELECTED_BORDER = '▎';
