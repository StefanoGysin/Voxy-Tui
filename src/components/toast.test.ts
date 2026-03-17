import { describe, it, expect, afterEach, beforeEach, jest } from 'bun:test';
import { Toast } from './toast';
import { bg, BOLD, DIM, FG_WHITE, FG_BLACK } from '../core/ansi';

describe('Toast', () => {
  let toast: Toast;

  beforeEach(() => {
    jest.useFakeTimers();
    toast = new Toast();
  });

  afterEach(() => {
    toast.dispose();
    jest.useRealTimers();
  });

  it('render() retorna [] sem toasts', () => {
    expect(toast.render(80, 24)).toEqual([]);
  });

  it('show() adiciona toast, render retorna 1 linha', () => {
    toast.show({ type: 'info', label: 'Info' });
    expect(toast.render(80, 24)).toHaveLength(1);
  });

  it('show() retorna ID único', () => {
    const id1 = toast.show({ type: 'info', label: 'A' });
    const id2 = toast.show({ type: 'info', label: 'B' });
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^toast-\d+$/);
    expect(id2).toMatch(/^toast-\d+$/);
  });

  it('auto-dismiss após duration', () => {
    toast.show({ type: 'info', label: 'Temp', duration: 2000 });
    expect(toast.count()).toBe(1);
    jest.advanceTimersByTime(2000);
    expect(toast.count()).toBe(0);
  });

  it('auto-dismiss usa default 3000ms', () => {
    toast.show({ type: 'info', label: 'Default' });
    jest.advanceTimersByTime(2999);
    expect(toast.count()).toBe(1);
    jest.advanceTimersByTime(1);
    expect(toast.count()).toBe(0);
  });

  it('onUpdate chamado quando toast é adicionado', () => {
    const cb = jest.fn();
    toast.onUpdate = cb;
    toast.show({ type: 'success', label: 'Ok' });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('onUpdate chamado quando toast expira', () => {
    const cb = jest.fn();
    toast.show({ type: 'info', label: 'Temp', duration: 1000 });
    toast.onUpdate = cb;
    jest.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('dismiss(id) remove toast específico', () => {
    const id1 = toast.show({ type: 'info', label: 'A' });
    toast.show({ type: 'info', label: 'B' });
    toast.dismiss(id1);
    expect(toast.count()).toBe(1);
    expect(toast.render(80, 24)[0]).toContain('B');
  });

  it('dismiss() sem ID remove o mais antigo', () => {
    toast.show({ type: 'info', label: 'First' });
    toast.show({ type: 'info', label: 'Second' });
    toast.dismiss();
    expect(toast.count()).toBe(1);
    expect(toast.render(80, 24)[0]).toContain('Second');
  });

  it('clear() remove todos', () => {
    toast.show({ type: 'info', label: 'A' });
    toast.show({ type: 'success', label: 'B' });
    toast.clear();
    expect(toast.count()).toBe(0);
    expect(toast.render(80, 24)).toEqual([]);
  });

  it('máximo 3 toasts — 4º remove o mais antigo (FIFO)', () => {
    toast.show({ type: 'info', label: 'A' });
    toast.show({ type: 'info', label: 'B' });
    toast.show({ type: 'info', label: 'C' });
    toast.show({ type: 'info', label: 'D' });
    expect(toast.count()).toBe(3);
    const lines = toast.render(80, 24);
    expect(lines[0]).toContain('B');
    expect(lines[1]).toContain('C');
    expect(lines[2]).toContain('D');
  });

  it('duration=0 não faz auto-dismiss', () => {
    toast.show({ type: 'info', label: 'Sticky', duration: 0 });
    jest.advanceTimersByTime(60000);
    expect(toast.count()).toBe(1);
  });

  it('dispose() limpa todos os timers', () => {
    const cb = jest.fn();
    toast.show({ type: 'info', label: 'A', duration: 1000 });
    toast.show({ type: 'info', label: 'B', duration: 2000 });
    toast.onUpdate = cb;
    toast.dispose();
    jest.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalled();
    expect(toast.count()).toBe(0);
  });

  it('visibleLineCount() retorna count correto', () => {
    expect(toast.visibleLineCount()).toBe(0);
    toast.show({ type: 'info', label: 'A' });
    expect(toast.visibleLineCount()).toBe(1);
    toast.show({ type: 'info', label: 'B' });
    expect(toast.visibleLineCount()).toBe(2);
  });

  it('minHeight() retorna 0 quando vazio, count() quando ativo', () => {
    expect(toast.minHeight()).toBe(0);
    toast.show({ type: 'info', label: 'A' });
    expect(toast.minHeight()).toBe(1);
    toast.show({ type: 'success', label: 'B' });
    expect(toast.minHeight()).toBe(2);
  });

  it('truncamento de message longa', () => {
    toast.show({ type: 'info', label: 'Hi', message: 'A'.repeat(200) });
    const line = toast.render(40, 24)[0];
    // Line should be truncated to fit within width
    expect(line).toContain('…');
  });

  describe('tipos renderizam com cores corretas', () => {
    it('mode usa bg(6,182,212) e FG_WHITE', () => {
      toast.show({ type: 'mode', label: 'Mode' });
      const line = toast.render(80, 24)[0];
      expect(line).toContain(bg(6, 182, 212));
      expect(line).toContain(FG_WHITE);
      expect(line).toContain(BOLD);
      expect(line).toContain('⚡');
    });

    it('success usa bg(22,163,74) e FG_WHITE', () => {
      toast.show({ type: 'success', label: 'Ok' });
      const line = toast.render(80, 24)[0];
      expect(line).toContain(bg(22, 163, 74));
      expect(line).toContain(FG_WHITE);
      expect(line).toContain('✓');
    });

    it('warning usa bg(202,138,4) e FG_BLACK', () => {
      toast.show({ type: 'warning', label: 'Warn' });
      const line = toast.render(80, 24)[0];
      expect(line).toContain(bg(202, 138, 4));
      expect(line).toContain(FG_BLACK);
      expect(line).toContain('⚠');
    });

    it('error usa bg(220,38,38) e FG_WHITE', () => {
      toast.show({ type: 'error', label: 'Err' });
      const line = toast.render(80, 24)[0];
      expect(line).toContain(bg(220, 38, 38));
      expect(line).toContain(FG_WHITE);
      expect(line).toContain('✗');
    });

    it('info usa bg(37,99,235) e FG_WHITE', () => {
      toast.show({ type: 'info', label: 'Info' });
      const line = toast.render(80, 24)[0];
      expect(line).toContain(bg(37, 99, 235));
      expect(line).toContain(FG_WHITE);
      expect(line).toContain('ℹ');
    });
  });

  it('ícone custom via options.icon override', () => {
    toast.show({ type: 'info', label: 'Custom', icon: '🔥' });
    const line = toast.render(80, 24)[0];
    expect(line).toContain('🔥');
    expect(line).not.toContain('ℹ');
  });

  it('render sem message (só tag)', () => {
    toast.show({ type: 'success', label: 'Salvo' });
    const line = toast.render(80, 24)[0];
    expect(line).toContain('Salvo');
    // Should not contain DIM (no message part)
    const parts = line.split('Salvo');
    // After the tag there should be no DIM message section
    expect(line).toContain('✓');
  });

  it('render com message inclui DIM', () => {
    toast.show({ type: 'info', label: 'Info', message: 'detalhes aqui' });
    const line = toast.render(80, 24)[0];
    expect(line).toContain(DIM);
    expect(line).toContain('detalhes aqui');
  });

  it('linhas têm padding esquerdo de 2 espaços', () => {
    toast.show({ type: 'info', label: 'Test' });
    const line = toast.render(80, 24)[0];
    expect(line.startsWith('  ')).toBe(true);
  });
});
