import { describe, test, expect, afterEach, beforeEach, jest } from 'bun:test';
import { ChatLayout } from './chat-layout';
import { ToolActivityLog } from './tool-activity-log';
import { Toast } from '../components/toast';
import { Sidebar } from '../components/sidebar';
import type { SidebarTab } from '../components/sidebar';
import { stripAnsi } from '../utils/strip-ansi';
import { measureWidth } from '../utils/width';
import type { ChatMessage } from './types';
import type { KeyEvent } from '../core/component';

describe('ChatLayout', () => {
  let layout: ChatLayout;
  afterEach(() => { layout?.statusBar.dispose(); });

  test('expõe messageList, inputBar, statusBar como propriedades', () => {
    layout = new ChatLayout();
    expect(layout.messageList).toBeDefined();
    expect(layout.inputBar).toBeDefined();
    expect(layout.statusBar).toBeDefined();
  });

  test('render retorna exatamente height linhas', () => {
    layout = new ChatLayout();
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
  });

  test('render retorna height linhas com conteúdo', () => {
    layout = new ChatLayout();
    layout.messageList.addMessage({
      id: '1', role: 'user', content: 'Hello', timestamp: new Date(),
    });
    const lines = layout.render(80, 15);
    expect(lines).toHaveLength(15);
  });

  test('handleKey delega ao inputBar', () => {
    layout = new ChatLayout();
    layout.inputBar.onFocus();
    layout.handleKey({ key: 'z', ctrl: false, meta: false, shift: false, raw: 'z' });
    expect(layout.inputBar.getValue()).toBe('z');
  });

  test('statusBar ocupa exatamente 1 linha na parte inferior', () => {
    layout = new ChatLayout();
    layout.statusBar.setModel('test-model');
    const lines = layout.render(80, 10);
    const lastLine = stripAnsi(lines[lines.length - 1]);
    expect(lastLine).toContain('test-model');
  });

  test('minHeight é razoável (> 4)', () => {
    layout = new ChatLayout();
    expect(layout.minHeight()).toBeGreaterThan(4);
  });
});

describe('ChatLayout — activityLog', () => {
  let layout: ChatLayout;
  let toolLog: ToolActivityLog;

  beforeEach(() => {
    jest.useFakeTimers();
    layout = new ChatLayout();
    toolLog = new ToolActivityLog();
  });

  afterEach(() => {
    layout.statusBar.dispose();
    toolLog.dispose();
    jest.useRealTimers();
  });

  test('render retorna exatamente height linhas com activityLog vazio', () => {
    layout.setActivityLog(toolLog);
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
  });

  test('render retorna exatamente height linhas com activityLog com 3 entries', () => {
    layout.setActivityLog(toolLog);
    toolLog.addTool('1', 'bash');
    toolLog.addTool('2', 'read_file');
    toolLog.addTool('3', 'edit');
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
  });

  test('linhas do activityLog aparecem entre messageList e inputBar', () => {
    layout.setActivityLog(toolLog);
    toolLog.addTool('1', 'bash', 'bun test');
    toolLog.updateTool('1', 'done');
    const lines = layout.render(80, 20).map((l: string) => stripAnsi(l));
    // inputBar tem separador '─' — find last index manually
    let separatorIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('─')) { separatorIdx = i; break; }
    }
    // statusBar é a última linha
    const statusIdx = lines.length - 1;
    // activityLog deve estar antes do separador do inputBar
    const activityIdx = lines.findIndex(l => l.includes('bash'));
    expect(activityIdx).toBeGreaterThanOrEqual(0);
    expect(activityIdx).toBeLessThan(separatorIdx);
    expect(activityIdx).toBeLessThan(statusIdx);
  });

  test('setActivityLog(null) remove o log e render volta ao normal', () => {
    layout.setActivityLog(toolLog);
    toolLog.addTool('1', 'bash');
    layout.setActivityLog(null);
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
    const hasActivity = lines.some(l => l.includes('bash'));
    expect(hasActivity).toBe(false);
  });

  test('minHeight cresce com activityLog ativo', () => {
    const baseHeight = layout.minHeight();
    layout.setActivityLog(toolLog);
    toolLog.addTool('1', 'bash');
    toolLog.addTool('2', 'read_file');
    expect(layout.minHeight()).toBe(baseHeight + 2);
  });
});

describe('ChatLayout — scroll', () => {
  let layout: ChatLayout;

  beforeEach(() => {
    jest.useFakeTimers();
    layout = new ChatLayout();
    for (let i = 0; i < 30; i++) {
      layout.messageList.addMessage({
        id: `${i}`, role: 'user', content: `Mensagem ${i}`,
        timestamp: new Date(),
      });
    }
  });

  afterEach(() => {
    layout.statusBar.dispose();
    jest.useRealTimers();
  });

  test('pageup move scroll para cima', () => {
    const before = layout.messageList.getScrollOffset();
    layout.handleKey({ key: 'pageup', ctrl: false, meta: false, shift: false, raw: '' });
    expect(layout.messageList.getScrollOffset()).toBeGreaterThan(before);
  });

  test('pagedown após pageup desce scroll', () => {
    layout.handleKey({ key: 'pageup', ctrl: false, meta: false, shift: false, raw: '' });
    const after_up = layout.messageList.getScrollOffset();
    layout.handleKey({ key: 'pagedown', ctrl: false, meta: false, shift: false, raw: '' });
    expect(layout.messageList.getScrollOffset()).toBeLessThan(after_up);
  });

  test('scroll-up (mouse) move scroll', () => {
    const before = layout.messageList.getScrollOffset();
    layout.handleKey({ key: 'scroll-up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(layout.messageList.getScrollOffset()).toBeGreaterThan(before);
  });

  test('scroll-down (mouse) após scroll-up desce', () => {
    layout.handleKey({ key: 'scroll-up', ctrl: false, meta: false, shift: false, raw: '' });
    const after_up = layout.messageList.getScrollOffset();
    jest.advanceTimersByTime(20); // passa o throttle
    layout.handleKey({ key: 'scroll-down', ctrl: false, meta: false, shift: false, raw: '' });
    expect(layout.messageList.getScrollOffset()).toBeLessThan(after_up);
  });

  test('throttle: dois scroll-up consecutivos ignoram o segundo', () => {
    layout.handleKey({ key: 'scroll-up', ctrl: false, meta: false, shift: false, raw: '' });
    const after_first = layout.messageList.getScrollOffset();
    layout.handleKey({ key: 'scroll-up', ctrl: false, meta: false, shift: false, raw: '' });
    expect(layout.messageList.getScrollOffset()).toBe(after_first);
  });
});

describe('ChatLayout — handleMouse', () => {
  let layout: ChatLayout;
  afterEach(() => { layout?.statusBar.dispose(); });

  test('handleMouse na área de mensagens → delega para messageList', () => {
    layout = new ChatLayout();
    const msg: ChatMessage = {
      id: '1', role: 'tool', content: '', timestamp: new Date(),
      toolName: 'T', toolInput: '', toolOutput: Array.from({ length: 10 }, (_, i) => `l${i}`),
      toolStatus: 'done', toolCollapsed: true,
    };
    layout.messageList.addMessage(msg);
    layout.render(80, 30);

    const result = layout.handleMouse({ x: 10, y: 1, button: 0, isRelease: false });
    expect(typeof result).toBe('boolean');
  });

  test('handleMouse abaixo da área de mensagens → retorna false', () => {
    layout = new ChatLayout();
    layout.render(80, 30);
    const result = layout.handleMouse({ x: 10, y: 30, button: 0, isRelease: false });
    expect(result).toBe(false);
  });

  test('handleMouseDrag na área de mensagens → delega para messageList', () => {
    layout = new ChatLayout();
    layout.messageList.addMessage({ id: '1', role: 'user', content: 'hello', timestamp: new Date() });
    layout.render(80, 30);
    // Setar um anchor primeiro (simular press)
    layout.handleMouse({ x: 5, y: 1, button: 0, isRelease: false });
    // Drag
    const result = layout.handleMouseDrag({ x: 10, y: 3, button: 0 });
    expect(result).toBe(true);
  });

  test('handleMouseDrag abaixo da área de mensagens → retorna false', () => {
    layout = new ChatLayout();
    layout.render(80, 30);
    const result = layout.handleMouseDrag({ x: 5, y: 30, button: 0 });
    expect(result).toBe(false);
  });
});

describe('ChatLayout — toast', () => {
  let layout: ChatLayout;
  let toast: Toast;

  beforeEach(() => {
    layout = new ChatLayout();
    toast = new Toast();
  });

  afterEach(() => {
    layout.statusBar.dispose();
    toast.dispose();
  });

  test('render retorna exatamente height linhas com toast vazio', () => {
    layout.setToast(toast);
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
  });

  test('render retorna exatamente height linhas com toast ativo (1 entry)', () => {
    layout.setToast(toast);
    toast.show({ type: 'mode', label: 'Autopilot', duration: 0 });
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
  });

  test('render retorna exatamente height linhas com toast ativo (3 entries)', () => {
    layout.setToast(toast);
    toast.show({ type: 'mode', label: 'A', duration: 0 });
    toast.show({ type: 'success', label: 'B', duration: 0 });
    toast.show({ type: 'info', label: 'C', duration: 0 });
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
  });

  test('linhas do toast aparecem entre activityLog e inputBar', () => {
    const toolLog = new ToolActivityLog();
    layout.setActivityLog(toolLog);
    layout.setToast(toast);
    toolLog.addTool('1', 'bash', 'bun test');
    toolLog.updateTool('1', 'done');
    toast.show({ type: 'mode', label: 'Autopilot', duration: 0 });
    const lines = layout.render(80, 20).map((l: string) => stripAnsi(l));

    // find activity line
    const activityIdx = lines.findIndex(l => l.includes('bash'));
    // find toast line
    const toastIdx = lines.findIndex(l => l.includes('Autopilot'));
    // find inputBar separator
    let separatorIdx = -1;
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].includes('─')) { separatorIdx = i; break; }
    }

    expect(activityIdx).toBeGreaterThanOrEqual(0);
    expect(toastIdx).toBeGreaterThan(activityIdx);
    expect(toastIdx).toBeLessThan(separatorIdx);

    toolLog.dispose();
  });

  test('setToast(null) remove o toast e render volta ao normal', () => {
    layout.setToast(toast);
    toast.show({ type: 'mode', label: 'Test', duration: 0 });
    layout.setToast(null);
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
    const hasToast = lines.some(l => l.includes('Test'));
    expect(hasToast).toBe(false);
  });

  test('minHeight cresce com toast ativo', () => {
    const baseHeight = layout.minHeight();
    layout.setToast(toast);
    toast.show({ type: 'info', label: 'X', duration: 0 });
    expect(layout.minHeight()).toBe(baseHeight + 1);
  });

  test('toast e activityLog coexistem corretamente', () => {
    const toolLog = new ToolActivityLog();
    layout.setActivityLog(toolLog);
    layout.setToast(toast);
    toolLog.addTool('1', 'bash');
    toast.show({ type: 'mode', label: 'Mode', duration: 0 });
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
    const stripped = lines.map(l => stripAnsi(l));
    expect(stripped.some(l => l.includes('bash'))).toBe(true);
    expect(stripped.some(l => l.includes('Mode'))).toBe(true);

    toolLog.dispose();
  });
});

// --- Helper: cria um SidebarTab fake ---
function createFakeTab(id: string, label: string): SidebarTab {
  return {
    id,
    label,
    render(contentWidth: number): string[] {
      return [`${label} content`];
    },
    handleKey(_event: KeyEvent): boolean {
      return false;
    },
    getHints(): string {
      return `${label} hints`;
    },
  };
}

function mkKey(key: string, opts?: Partial<KeyEvent>): KeyEvent {
  return { key, ctrl: false, meta: false, shift: false, raw: key, ...opts };
}

describe('ChatLayout — sidebar render', () => {
  let layout: ChatLayout;
  let sidebar: Sidebar;

  beforeEach(() => {
    layout = new ChatLayout();
    sidebar = new Sidebar();
    sidebar.addTab(createFakeTab('tab1', 'Settings'));
  });

  afterEach(() => {
    layout.statusBar.dispose();
  });

  test('sem sidebar: render usa largura total', () => {
    const lines = layout.render(100, 20);
    expect(lines).toHaveLength(20);
  });

  test('sidebar escondido: render usa largura total', () => {
    layout.setSidebar(sidebar);
    // sidebar começa não-visível
    const lines = layout.render(100, 20);
    expect(lines).toHaveLength(20);
  });

  test('sidebar visível: render retorna height linhas', () => {
    layout.setSidebar(sidebar);
    sidebar.setVisible(true);
    const lines = layout.render(100, 20);
    expect(lines).toHaveLength(20);
  });

  test('sidebar visível: linhas contêm conteúdo do sidebar', () => {
    layout.setSidebar(sidebar);
    sidebar.setVisible(true);
    const lines = layout.render(100, 20);
    // Sidebar renderiza com borda │ — verificar que alguma linha contém │
    const stripped = lines.map(l => stripAnsi(l));
    const hasBorder = stripped.some(l => l.includes('│'));
    expect(hasBorder).toBe(true);
  });

  test('sidebar visível em terminal estreito (< 68): sidebar auto-esconde', () => {
    layout.setSidebar(sidebar);
    sidebar.setVisible(true);
    // 50 cols < 40 (min chat) + 28 (min sidebar) = 68
    const lines = layout.render(50, 20);
    expect(lines).toHaveLength(20);
    // Não deve ter conteúdo de sidebar (sem borda │)
    const stripped = lines.map(l => stripAnsi(l));
    const hasBorder = stripped.some(l => l.includes('│'));
    expect(hasBorder).toBe(false);
  });

  test('sidebar visível em terminal largo: sidebar ocupa ~30%', () => {
    layout.setSidebar(sidebar);
    sidebar.setVisible(true);
    const width = 120;
    const lines = layout.render(width, 20);
    expect(lines).toHaveLength(20);
    // Cada linha deve ter exatamente width colunas visuais
    for (const line of lines) {
      const visual = measureWidth(stripAnsi(line));
      expect(visual).toBe(width);
    }
  });

  test('setSidebar(null) remove o sidebar', () => {
    layout.setSidebar(sidebar);
    sidebar.setVisible(true);
    layout.setSidebar(null);
    const lines = layout.render(100, 20);
    expect(lines).toHaveLength(20);
    const stripped = lines.map(l => stripAnsi(l));
    const hasBorder = stripped.some(l => l.includes('│'));
    expect(hasBorder).toBe(false);
  });
});

describe('ChatLayout — sidebar foco', () => {
  let layout: ChatLayout;
  let sidebar: Sidebar;

  beforeEach(() => {
    layout = new ChatLayout();
    sidebar = new Sidebar();
    sidebar.addTab(createFakeTab('tab1', 'Settings'));
    layout.setSidebar(sidebar);
  });

  afterEach(() => {
    layout.statusBar.dispose();
  });

  test('isSidebarFocused é false inicialmente', () => {
    sidebar.setVisible(true);
    expect(layout.isSidebarFocused()).toBe(false);
  });

  test('Tab alterna foco para sidebar', () => {
    sidebar.setVisible(true);
    layout.handleKey(mkKey('tab'));
    expect(layout.isSidebarFocused()).toBe(true);
  });

  test('Tab duplo volta foco para chat', () => {
    sidebar.setVisible(true);
    layout.handleKey(mkKey('tab'));
    layout.handleKey(mkKey('tab'));
    expect(layout.isSidebarFocused()).toBe(false);
  });

  test('Tab sem sidebar visível não alterna foco', () => {
    // sidebar não visível
    layout.handleKey(mkKey('tab'));
    expect(layout.isSidebarFocused()).toBe(false);
  });

  test('quando sidebar tem foco, teclas são delegadas ao sidebar', () => {
    sidebar.setVisible(true);
    layout.handleKey(mkKey('tab')); // foco no sidebar
    // inputBar não deve receber a tecla
    layout.inputBar.onFocus();
    layout.handleKey(mkKey('z'));
    // 'z' foi delegado ao sidebar (que não faz nada com 'z' → delegado à tab → retorna false)
    // inputBar NÃO deve ter recebido a tecla
    expect(layout.inputBar.getValue()).toBe('');
  });

  test('quando chat tem foco, teclas vão para inputBar', () => {
    sidebar.setVisible(true);
    layout.render(100, 20);
    layout.inputBar.onFocus();
    layout.handleKey(mkKey('z'));
    expect(layout.inputBar.getValue()).toBe('z');
  });
});

describe('ChatLayout — sidebar mouse routing', () => {
  let layout: ChatLayout;
  let sidebar: Sidebar;

  beforeEach(() => {
    layout = new ChatLayout();
    sidebar = new Sidebar();
    sidebar.addTab(createFakeTab('tab1', 'Settings'));
    layout.setSidebar(sidebar);
    sidebar.setVisible(true);
    // Render para calcular lastChatWidth e lastSidebarWidth
    layout.render(100, 20);
  });

  afterEach(() => {
    layout.statusBar.dispose();
  });

  test('click no lado direito roteia ao sidebar', () => {
    // width=100, sidebar ~30 cols → chatWidth ~70
    const result = layout.handleMouse({ x: 75, y: 1, button: 0, isRelease: false });
    expect(result).toBe(true); // sidebar consome
    expect(layout.isSidebarFocused()).toBe(true);
  });

  test('click no lado esquerdo roteia ao chat', () => {
    // Primeiro dar foco ao sidebar
    layout.handleKey(mkKey('tab'));
    expect(layout.isSidebarFocused()).toBe(true);

    // Click no chat deve tirar foco do sidebar
    layout.handleMouse({ x: 10, y: 1, button: 0, isRelease: false });
    expect(layout.isSidebarFocused()).toBe(false);
  });

  test('drag no lado do sidebar é consumido sem ação', () => {
    const result = layout.handleMouseDrag({ x: 75, y: 5, button: 0 });
    expect(result).toBe(true);
  });

  test('drag no lado do chat roteia normalmente', () => {
    layout.messageList.addMessage({ id: '1', role: 'user', content: 'hello', timestamp: new Date() });
    layout.render(100, 20);
    // Setar anchor primeiro (simular press)
    layout.handleMouse({ x: 5, y: 1, button: 0, isRelease: false });
    const result = layout.handleMouseDrag({ x: 10, y: 1, button: 0 });
    expect(result).toBe(true);
  });
});
