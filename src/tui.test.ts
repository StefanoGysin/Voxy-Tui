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
