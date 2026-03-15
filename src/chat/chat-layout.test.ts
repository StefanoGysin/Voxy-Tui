import { describe, test, expect, afterEach, beforeEach, jest } from 'bun:test';
import { ChatLayout } from './chat-layout';
import { ToolActivityLog } from './tool-activity-log';
import { stripAnsi } from '../utils/strip-ansi';
import type { ChatMessage } from './types';

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
