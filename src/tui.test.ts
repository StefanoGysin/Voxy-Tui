import { describe, it, expect, afterEach } from 'bun:test';
import { MockTerminal } from './test/setup';
import { TUI } from './tui';

describe('TUI', () => {
  let tui: TUI;

  afterEach(() => {
    tui?.stop();
  });

  it('cria layout, renderer e scheduler', () => {
    tui = new TUI({ terminal: new MockTerminal() });
    expect(tui.layout).toBeDefined();
  });

  it('renderNow() produz output no terminal', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    expect(term.getOutput()).not.toBe('');
  });

  it('stop() pode ser chamado múltiplas vezes sem erro', () => {
    tui = new TUI({ terminal: new MockTerminal() });
    tui.start();
    expect(() => { tui.stop(); tui.stop(); }).not.toThrow();
  });

  it('start() idempotente — segunda chamada não quebra', () => {
    tui = new TUI({ terminal: new MockTerminal() });
    expect(() => { tui.start(); tui.start(); }).not.toThrow();
    tui.stop();
  });

  it('scheduleRender() não lança após stop()', () => {
    tui = new TUI({ terminal: new MockTerminal() });
    tui.start();
    tui.stop();
    expect(() => tui.scheduleRender()).not.toThrow();
  });

  it('start() usa alternate screen buffer', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    expect(term.getOutput()).toContain('\x1b[?1049h');
    expect(term.getOutput()).toContain('\x1b[?1002h');
  });

  it('stop() usa EXIT_ALT_SCREEN e restaura cursor', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    term.reset();
    tui.stop();
    expect(term.getOutput()).toContain('\x1b[?1049l');
    expect(term.getOutput()).toContain('\x1b[?25h');
  });

  it('start() esconde cursor durante a TUI', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    expect(term.getOutput()).toContain('\x1b[?25l');
  });

  it('stop() desabilita mouse tracking', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    term.reset();
    tui.stop();
    expect(term.getOutput()).toContain('\x1b[?1002l');
  });

  it('start() emite ENTER_ALT_SCREEN + ERASE_SCREEN + cursorTo(1,1)', () => {
    const term = new MockTerminal(80, 24);
    tui = new TUI({ terminal: term });
    tui.start();
    const output = term.getOutput();
    // ENTER_ALT_SCREEN
    expect(output).toContain('\x1b[?1049h');
    // ERASE_SCREEN (\x1b[2J) limpa tela visível
    expect(output).toContain('\x1b[2J');
    // cursorTo(1,1)
    expect(output).toContain('\x1b[1;1H');
    // Não usa ERASE_SCROLLBACK — alternate screen tem buffer próprio
    expect(output).not.toContain('\x1b[3J');
  });

  it('stop() emite EXIT_ALT_SCREEN sem ERASE_SCROLLBACK', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    term.reset();
    tui.stop();
    expect(term.getOutput()).toContain('\x1b[?1049l');  // EXIT_ALT_SCREEN
    // Não precisa ERASE — EXIT_ALT_SCREEN restaura o buffer original
    expect(term.getOutput()).not.toContain('\x1b[3J');
    expect(term.getOutput()).not.toContain('\x1b[2J');
  });

  it('adicionar mensagem e re-render produz output diferente', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    const before = term.getOutput();
    tui.layout.messageList.addMessage({
      id: '1', role: 'user', content: 'Olá', timestamp: new Date()
    });
    tui.renderNow();
    expect(term.getOutput()).not.toBe(before);
  });
});
