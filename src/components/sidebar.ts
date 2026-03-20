import type { Component, KeyEvent, MouseClickEvent } from '../core/component';
import { RESET, BOLD, DIM, bg, fg } from '../core/ansi';
import { padEndAnsi } from '../utils/width';
import { stripAnsi } from '../utils/strip-ansi';
import { measureWidth } from '../utils/width';
import { truncate } from '../utils/truncate';

/**
 * Interface para conteúdo plugável de uma tab do Sidebar.
 */
export interface SidebarTab {
  /** ID único da tab. */
  id: string;
  /** Label curta exibida na nav (ex: "Permissões", "Modelo"). */
  label: string;
  /** Badge opcional à direita da label (ex: contagem "35"). */
  badge?: string;
  /**
   * Renderiza o conteúdo desta tab.
   * Recebe largura disponível (sidebar width - padding).
   * Retorna linhas de conteúdo (pode ser mais que height → scroll interno).
   */
  render(contentWidth: number): string[];
  /**
   * Processa tecla quando esta tab está ativa.
   * Retorna true se consumiu o evento.
   */
  handleKey(event: KeyEvent): boolean;
  /**
   * Processa click de mouse quando esta tab está ativa.
   * contentRow e contentCol são relativos à área de conteúdo (0-based).
   * Retorna true se consumiu o evento.
   */
  handleMouse?(contentRow: number, contentCol: number, event: MouseClickEvent): boolean;
  /** Hints de teclado para o footer (ex: "↑↓ navegar · enter selecionar"). */
  getHints(): string;
}

export interface SidebarOptions {
  borderFg?: string;
  headerBg?: string;
  titleFg?: string;
  tabActiveFg?: string;
  tabInactiveFg?: string;
  hintsFg?: string;
  bgColor?: string;
  title?: string;
  closeHint?: string;
}

const BORDER_CHAR = '│';
const SEP_CHAR = '─';
const CONTENT_PAD = 2; // espaços de padding interno cada lado

export class Sidebar implements Component {
  focusable = true;

  private tabs: SidebarTab[] = [];
  private activeTabIndex = 0;
  private contentScrollOffset = 0;
  private visible = false;

  private readonly borderFg: string;
  private readonly headerBg: string;
  private readonly titleFg: string;
  private readonly tabActiveFg: string;
  private readonly tabInactiveFg: string;
  private readonly hintsFg: string;
  private readonly bgColor: string;
  private readonly title: string;
  private readonly closeHint: string;

  onVisibilityChange?: (visible: boolean) => void;
  onUpdate?: () => void;

  constructor(options?: SidebarOptions) {
    this.borderFg = options?.borderFg ?? fg(40, 55, 70);
    this.headerBg = options?.headerBg ?? bg(15, 20, 30);
    this.titleFg = options?.titleFg ?? fg(224, 242, 254);
    this.tabActiveFg = options?.tabActiveFg ?? fg(34, 211, 238);
    this.tabInactiveFg = options?.tabInactiveFg ?? fg(126, 143, 160);
    this.hintsFg = options?.hintsFg ?? fg(61, 90, 110);
    this.bgColor = options?.bgColor ?? bg(12, 16, 26);
    this.title = options?.title ?? 'Configurações';
    this.closeHint = options?.closeHint ?? 'Ctrl+B';
  }

  addTab(tab: SidebarTab): void {
    this.tabs.push(tab);
  }

  removeTab(id: string): void {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.tabs.splice(idx, 1);
    if (this.activeTabIndex >= this.tabs.length) {
      this.activeTabIndex = Math.max(0, this.tabs.length - 1);
    }
    this.contentScrollOffset = 0;
  }

  setActiveTab(id: string): void {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    this.activeTabIndex = idx;
    this.contentScrollOffset = 0;
  }

  getActiveTabId(): string | undefined {
    return this.tabs[this.activeTabIndex]?.id;
  }

  setVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    this.contentScrollOffset = 0;
    this.onVisibilityChange?.(visible);
  }

  isVisible(): boolean {
    return this.visible;
  }

  toggle(): void {
    this.setVisible(!this.visible);
  }

  render(width: number, height: number): string[] {
    if (!this.visible || width < 10) {
      return Array.from({ length: height }, () => '');
    }

    const innerWidth = width - 1; // -1 para borda │ esquerda
    const contentWidth = Math.max(1, innerWidth - CONTENT_PAD * 2);

    const lines: string[] = [];

    // 1. Header
    lines.push(this.renderHeader(innerWidth));

    // 2. Separador
    lines.push(this.renderSeparator(innerWidth));

    // 3. Tabs nav (se mais de 1 tab)
    const hasMultipleTabs = this.tabs.length > 1;
    if (hasMultipleTabs) {
      lines.push(this.renderTabs(innerWidth));
      lines.push(this.renderSeparator(innerWidth));
    }

    // 4. Calcular espaço do conteúdo (total - header/seps/footer)
    const footerLines = 2; // separador + hints
    const contentHeight = Math.max(1, height - lines.length - footerLines);

    // 5. Conteúdo
    const activeTab = this.tabs[this.activeTabIndex];
    if (activeTab) {
      lines.push(...this.renderContent(activeTab, contentWidth, contentHeight, innerWidth));
    } else {
      lines.push(...this.renderEmptyContent(contentHeight, innerWidth));
    }

    // 6. Footer
    lines.push(this.renderSeparator(innerWidth));
    lines.push(this.renderFooter(innerWidth));

    // 7. Garantir exatamente height linhas
    while (lines.length < height) {
      lines.push(this.renderEmptyLine(innerWidth));
    }
    if (lines.length > height) {
      lines.length = height;
    }

    // 8. Adicionar borda │ esquerda a cada linha
    return lines.map(line => `${this.bgColor}${this.borderFg}${BORDER_CHAR}${line}${RESET}`);
  }

  handleKey(event: KeyEvent): boolean {
    if (!this.visible) return false;

    // Tab switching: Ctrl+← e Ctrl+→
    if (event.ctrl && event.key === 'left' && this.tabs.length > 1) {
      this.prevTab();
      return true;
    }
    if (event.ctrl && event.key === 'right' && this.tabs.length > 1) {
      this.nextTab();
      return true;
    }

    // Scroll do conteúdo
    if (event.key === 'scroll-up') {
      this.contentScrollOffset = Math.max(0, this.contentScrollOffset - 3);
      return true;
    }
    if (event.key === 'scroll-down') {
      this.contentScrollOffset += 3;
      return true;
    }
    if (event.key === 'pageup') {
      this.contentScrollOffset = Math.max(0, this.contentScrollOffset - 10);
      return true;
    }
    if (event.key === 'pagedown') {
      this.contentScrollOffset += 10;
      return true;
    }

    // Delegar para a tab ativa
    const activeTab = this.tabs[this.activeTabIndex];
    if (activeTab) {
      return activeTab.handleKey(event);
    }

    return false;
  }

  handleMouse(event: MouseClickEvent): boolean {
    if (!this.visible) return false;

    const row = event.y; // 1-based
    const col = event.x - 1; // ajustar para 0-based (remover borda esquerda)

    // Header (row 1): ignorar
    if (row <= 1) return true;

    // Separador (row 2): ignorar
    if (row === 2) return true;

    const hasMultipleTabs = this.tabs.length > 1;
    let contentStartRow: number;

    if (hasMultipleTabs) {
      // row 3 = tabs, row 4 = sep
      if (row === 3) {
        // Click na zona de tabs: determinar qual tab
        this.handleTabClick(col);
        return true;
      }
      if (row === 4) return true;
      contentStartRow = 5;
    } else {
      contentStartRow = 3;
    }

    // Calcular zona de conteúdo vs footer
    // Footer ocupa últimas 2 linhas (sep + hints)
    // Delegar para tab ativa se na zona de conteúdo
    const activeTab = this.tabs[this.activeTabIndex];
    if (activeTab?.handleMouse) {
      const contentRow = row - contentStartRow + this.contentScrollOffset;
      const contentCol = Math.max(0, col - CONTENT_PAD);
      return activeTab.handleMouse(contentRow, contentCol, event);
    }

    return true;
  }

  // --- Private render helpers ---

  private renderHeader(innerWidth: number): string {
    const left = ` ${this.titleFg}${BOLD}${this.title}${RESET}`;
    const right = `${this.hintsFg}${this.closeHint}${RESET} `;
    const leftVisual = measureWidth(stripAnsi(left));
    const rightVisual = measureWidth(stripAnsi(right));
    const gap = Math.max(1, innerWidth - leftVisual - rightVisual);
    const bgLeft = left.replaceAll(RESET, RESET + this.headerBg);
    const bgRight = right.replaceAll(RESET, RESET + this.headerBg);
    const line = `${this.headerBg}${bgLeft}${' '.repeat(gap)}${bgRight}${RESET}`;
    return padEndAnsi(line, innerWidth);
  }

  private renderSeparator(innerWidth: number): string {
    return `${this.bgColor}${this.borderFg}${SEP_CHAR.repeat(innerWidth)}${RESET}`;
  }

  private renderTabs(innerWidth: number): string {
    let tabsStr = '';
    let visualLen = 1; // starts with 1 space padding

    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      const isActive = i === this.activeTabIndex;
      const colorFg = isActive ? this.tabActiveFg : this.tabInactiveFg;
      const weight = isActive ? BOLD : '';

      let tabLabel = ` ${colorFg}${weight}${tab.label}${RESET}`;
      if (tab.badge) {
        tabLabel += ` ${DIM}${tab.badge}${RESET}`;
      }

      const tabVisual = measureWidth(stripAnsi(tabLabel));
      if (visualLen + tabVisual + 1 > innerWidth) break; // não cabe

      tabsStr += tabLabel;
      visualLen += tabVisual;

      // Separador entre tabs
      if (i < this.tabs.length - 1) {
        tabsStr += ' ';
        visualLen += 1;
      }
    }

    // Re-apply bgColor after every RESET in tab labels
    const bgTabs = tabsStr.replaceAll(RESET, RESET + this.bgColor);
    return padEndAnsi(`${this.bgColor} ${bgTabs}`, innerWidth);
  }

  private renderContent(
    tab: SidebarTab,
    contentWidth: number,
    contentHeight: number,
    innerWidth: number,
  ): string[] {
    const allLines = tab.render(contentWidth);

    // Clamp scroll offset
    const maxScroll = Math.max(0, allLines.length - contentHeight);
    if (this.contentScrollOffset > maxScroll) {
      this.contentScrollOffset = maxScroll;
    }

    // Viewport
    const visible = allLines.slice(
      this.contentScrollOffset,
      this.contentScrollOffset + contentHeight,
    );

    const pad = ' '.repeat(CONTENT_PAD);
    const result = visible.map(line => {
      // Re-apply bgColor after every RESET in content to prevent bg bleed-through
      const bgLine = line.replaceAll(RESET, RESET + this.bgColor);
      return padEndAnsi(`${this.bgColor}${pad}${bgLine}`, innerWidth);
    });

    // Preencher restante
    while (result.length < contentHeight) {
      result.push(padEndAnsi(`${this.bgColor}`, innerWidth));
    }

    return result;
  }

  private renderEmptyContent(contentHeight: number, innerWidth: number): string[] {
    const result: string[] = [];
    for (let i = 0; i < contentHeight; i++) {
      result.push(padEndAnsi(`${this.bgColor}`, innerWidth));
    }
    return result;
  }

  private renderEmptyLine(innerWidth: number): string {
    return padEndAnsi(`${this.bgColor}`, innerWidth);
  }

  private renderFooter(innerWidth: number): string {
    const activeTab = this.tabs[this.activeTabIndex];
    const hints = activeTab?.getHints() ?? '';
    const truncatedHints = truncate(hints, Math.max(0, innerWidth - 4));
    // Re-apply bgColor after every RESET in hints
    const bgHints = truncatedHints.replaceAll(RESET, RESET + this.bgColor);
    return padEndAnsi(
      `${this.bgColor} ${this.hintsFg}${bgHints}${RESET}`,
      innerWidth,
    );
  }

  // --- Private navigation ---

  private prevTab(): void {
    if (this.tabs.length === 0) return;
    this.activeTabIndex = (this.activeTabIndex - 1 + this.tabs.length) % this.tabs.length;
    this.contentScrollOffset = 0;
  }

  private nextTab(): void {
    if (this.tabs.length === 0) return;
    this.activeTabIndex = (this.activeTabIndex + 1) % this.tabs.length;
    this.contentScrollOffset = 0;
  }

  private handleTabClick(col: number): void {
    // Simplificação: dividir igualmente o espaço entre tabs
    if (this.tabs.length === 0) return;
    const tabWidth = Math.floor(col / Math.max(1, Math.ceil(col / this.tabs.length)));
    // Calcular posição acumulada de cada tab
    let accum = 1; // 1 space padding
    for (let i = 0; i < this.tabs.length; i++) {
      const tab = this.tabs[i];
      const labelLen = measureWidth(tab.label) + 2; // padding around label
      const badgeLen = tab.badge ? measureWidth(tab.badge) + 1 : 0;
      const tabLen = labelLen + badgeLen + 1; // +1 separator

      if (col >= accum && col < accum + tabLen) {
        this.activeTabIndex = i;
        this.contentScrollOffset = 0;
        return;
      }
      accum += tabLen;
    }
  }
}
