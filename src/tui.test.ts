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

  it('start() NÃO usa alt-screen buffer', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    expect(term.getOutput()).not.toContain('\x1b[?1049h');
    expect(term.getOutput()).toContain('\x1b[?1002h');
  });

  it('stop() NÃO usa EXIT_ALT_SCREEN, restaura cursor', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    term.reset();
    tui.stop();
    expect(term.getOutput()).not.toContain('\x1b[?1049l');
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

  it('start() reserva espaço: emite \\n × rows + cursorUp(rows) antes do primeiro render', () => {
    const term = new MockTerminal(80, 24);
    tui = new TUI({ terminal: term });
    tui.start();
    const output = term.getOutput();
    // 24 newlines consecutivos = reserva de espaço (rows = 24)
    expect(output).toContain('\n'.repeat(24));
    // cursorUp(24) para voltar ao topo da área reservada
    expect(output).toContain('\x1b[24A');
  });

  it('stop() emite ERASE_SCREEN + cursorTo(1,1) para evitar ghost text no próximo start()', () => {
    const term = new MockTerminal();
    tui = new TUI({ terminal: term });
    tui.start();
    term.reset();
    tui.stop();
    expect(term.getOutput()).toContain('\x1b[2J');    // ERASE_SCREEN
    expect(term.getOutput()).toContain('\x1b[1;1H'); // cursorTo(1, 1)
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
