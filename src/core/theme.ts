import { bg, fg, ITALIC } from './ansi';

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

  // Toast
  readonly toastModeBg: string;
  readonly toastSuccessBg: string;
  readonly toastWarningBg: string;
  readonly toastErrorBg: string;
  readonly toastInfoBg: string;

  // StatusBar
  readonly statusStreamingFg: string;
  readonly statusErrorFg: string;
  readonly statusIdleFg: string;
  readonly statusModelFg: string;
  readonly statusContextNormalFg: string;
  readonly statusContextWarningFg: string;
  readonly statusContextDangerFg: string;
  readonly statusThinkingFg: string;
  readonly statusThinkingDotFg: string;
  readonly statusSeparatorFg: string;

  // Message backgrounds & text
  readonly toolMsgBg: string;
  readonly userMsgBg: string;
  readonly assistantMsgBg: string;
  readonly userTextFg: string;
  readonly userTextStyle: string;

  // ToolActivityLog
  readonly toolNameFg: string;
  readonly toolRunningFg: string;
  readonly toolDoneFg: string;
  readonly toolErrorFg: string;
  readonly toolLabelFg: string;
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

  // Toast
  toastModeBg: bg(6, 182, 212),
  toastSuccessBg: bg(22, 163, 74),
  toastWarningBg: bg(202, 138, 4),
  toastErrorBg: bg(220, 38, 38),
  toastInfoBg: bg(37, 99, 235),

  // StatusBar
  statusStreamingFg: fg(234, 179, 8),
  statusErrorFg: fg(239, 68, 68),
  statusIdleFg: fg(139, 148, 158),
  statusModelFg: fg(34, 211, 238),
  statusContextNormalFg: fg(139, 148, 158),
  statusContextWarningFg: fg(234, 179, 8),
  statusContextDangerFg: fg(239, 68, 68),
  statusThinkingFg: fg(139, 148, 158),
  statusThinkingDotFg: fg(34, 211, 238),
  statusSeparatorFg: fg(61, 90, 110),

  // Message backgrounds & text
  toolMsgBg: bg(15, 20, 42),
  userMsgBg: bg(12, 16, 26),
  assistantMsgBg: bg(12, 16, 26),
  userTextFg: fg(34, 211, 238),
  userTextStyle: ITALIC,

  // ToolActivityLog
  toolNameFg: fg(34, 211, 238),
  toolRunningFg: fg(234, 179, 8),
  toolDoneFg: fg(74, 222, 128),
  toolErrorFg: fg(239, 68, 68),
  toolLabelFg: fg(139, 148, 158),
};

/** Caractere visual para borda de item selecionado (não é sequência ANSI). */
export const SELECTED_BORDER = '▎';
