import { describe, expect, test, beforeEach, afterEach, jest } from 'bun:test';
import { Spinner, BRAILLE_FRAMES } from './spinner';

describe('Spinner', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.useRealTimers(); });

  test('render returns empty when inactive', () => {
    const s = new Spinner('loading');
    expect(s.render(80, 24)).toEqual([]);
  });

  test('render returns line with frame and label after start', () => {
    const s = new Spinner('loading');
    s.start();
    const lines = s.render(80, 24);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('loading');
    expect(lines[0]).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
    s.stop();
  });

  test('frame advances every 80ms', () => {
    const s = new Spinner('test');
    s.start();
    const frame0 = s.render(80, 24)[0];
    jest.advanceTimersByTime(80);
    const frame1 = s.render(80, 24)[0];
    expect(frame0).not.toBe(frame1);
    s.stop();
  });

  test('stop() ends animation - render returns empty', () => {
    const s = new Spinner('loading');
    s.start();
    s.stop();
    expect(s.render(80, 24)).toEqual([]);
  });

  test('onUpdate callback is called each frame', () => {
    let count = 0;
    const s = new Spinner('loading', () => count++);
    s.start();
    jest.advanceTimersByTime(80 * 3);
    expect(count).toBe(3);
    s.stop();
  });

  test('setLabel updates label without stopping spinner', () => {
    const s = new Spinner('before');
    s.start();
    s.setLabel('after');
    expect(s.render(80, 24)[0]).toContain('after');
    s.stop();
  });

  test('uses yellow color and reset', () => {
    const s = new Spinner();
    s.start();
    const line = s.render(80, 24)[0];
    expect(line).toContain('\x1b[33m'); // FG_YELLOW
    expect(line).toContain('\x1b[0m');  // RESET
    s.stop();
  });
});
