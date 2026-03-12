import { describe, it, expect, afterEach, beforeEach, jest } from 'bun:test';
import { StreamingThinkingIndicator } from './streaming-thinking-indicator';

describe('StreamingThinkingIndicator', () => {
  let indicator: StreamingThinkingIndicator;

  beforeEach(() => {
    jest.useFakeTimers();
    indicator = new StreamingThinkingIndicator();
  });

  afterEach(() => {
    indicator.dispose();
    jest.useRealTimers();
  });

  it('render() retorna [] antes de start()', () => {
    expect(indicator.render(80, 24)).toEqual([]);
  });

  it('isActive() = false antes de start()', () => {
    expect(indicator.isActive()).toBe(false);
  });

  it('render() retorna 1 linha após start()', () => {
    indicator.start();
    const lines = indicator.render(80, 24);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('Pensando');
  });

  it('isActive() = true após start()', () => {
    indicator.start();
    expect(indicator.isActive()).toBe(true);
  });

  it('start() é idempotente — segunda chamada não duplica timer', () => {
    const cb = jest.fn();
    indicator.onUpdate = cb;
    indicator.start();
    indicator.start();
    jest.advanceTimersByTime(1000);
    // Se dois timers rodassem, cb seria chamado 2x
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('elapsedSeconds incrementa 1 por segundo', () => {
    indicator.start();
    expect(indicator.getElapsedSeconds()).toBe(0);
    jest.advanceTimersByTime(1000);
    expect(indicator.getElapsedSeconds()).toBe(1);
    jest.advanceTimersByTime(3000);
    expect(indicator.getElapsedSeconds()).toBe(4);
  });

  it('render() mostra tempo decorrido', () => {
    indicator.start();
    jest.advanceTimersByTime(5000);
    expect(indicator.render(80, 24)[0]).toContain('5s');
  });

  it('render() retorna [] após stop()', () => {
    indicator.start();
    indicator.stop();
    expect(indicator.render(80, 24)).toEqual([]);
  });

  it('isActive() = false após stop()', () => {
    indicator.start();
    indicator.stop();
    expect(indicator.isActive()).toBe(false);
  });

  it('onUpdate() é chamado a cada segundo', () => {
    const cb = jest.fn();
    indicator.onUpdate = cb;
    indicator.start();
    jest.advanceTimersByTime(3000);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('dispose() para o timer', () => {
    const cb = jest.fn();
    indicator.onUpdate = cb;
    indicator.start();
    indicator.dispose();
    jest.advanceTimersByTime(3000);
    expect(cb).not.toHaveBeenCalled();
  });
});
