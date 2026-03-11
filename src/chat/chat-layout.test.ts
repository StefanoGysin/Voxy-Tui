import { describe, test, expect, afterEach } from 'bun:test';
import { ChatLayout } from './chat-layout';
import { stripAnsi } from '../utils/strip-ansi';

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
