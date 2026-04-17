import { describe, test, expect, afterEach } from 'bun:test';
import { StatusBar } from './status-bar';
import { stripAnsi } from '../utils/strip-ansi';

describe('StatusBar', () => {
  let bar: StatusBar;
  afterEach(() => { bar?.dispose(); });

  test('minHeight retorna 1', () => {
    bar = new StatusBar();
    expect(bar.minHeight()).toBe(1);
  });

  test('render retorna exatamente 1 linha', () => {
    bar = new StatusBar();
    const lines = bar.render(80, 1);
    expect(lines).toHaveLength(1);
  });

  test('model name aparece na linha renderizada', () => {
    bar = new StatusBar();
    bar.setModel('claude-opus-4-6');
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('claude-opus-4-6');
  });

  test('status text aparece no modo idle', () => {
    bar = new StatusBar();
    bar.setStatus('Ready');
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('Ready');
  });

  test('modo error mostra símbolo de erro', () => {
    bar = new StatusBar();
    bar.setMode('error');
    bar.setStatus('Connection failed');
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('✗');
    expect(line).toContain('Connection failed');
  });

  test('dispose não lança erros mesmo sem timer', () => {
    bar = new StatusBar();
    expect(() => bar.dispose()).not.toThrow();
  });

  test('setContextUsage mostra tokens formatados', () => {
    bar = new StatusBar();
    bar.setModel('gpt-5.2');
    bar.setContextUsage(11000, 200000);
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('11.0k / 200k');
  });

  test('contexto > 80% renderiza sem erro', () => {
    bar = new StatusBar();
    bar.setModel('gpt-5.2');
    bar.setContextUsage(170000, 200000);
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('170k / 200k');
  });

  test('setThinking auto mostra Thinking e auto', () => {
    bar = new StatusBar();
    bar.setThinking('auto');
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('Thinking');
    expect(line).toContain('auto');
  });

  test('setThinking off não mostra Thinking', () => {
    bar = new StatusBar();
    bar.setThinking('off');
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).not.toContain('Thinking');
  });

  test('modelo + contexto + thinking com separador │', () => {
    bar = new StatusBar();
    bar.setModel('gpt-5.2');
    bar.setContextUsage(11000, 200000);
    bar.setThinking('auto');
    bar.setStatus('Copilot');
    const line = stripAnsi(bar.render(120, 1)[0]);
    expect(line).toContain('Copilot');
    expect(line).toContain('│');
    expect(line).toContain('gpt-5.2');
    expect(line).toContain('11.0k / 200k');
    expect(line).toContain('Thinking');
    expect(line).toContain('auto');
  });

  test('modelo sem contexto mostra só o nome', () => {
    bar = new StatusBar();
    bar.setModel('gpt-5.2');
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('gpt-5.2');
    expect(line).not.toContain('/');
  });

  test('setTasks(2, false) mostra "● 2 tasks"', () => {
    bar = new StatusBar();
    bar.setTasks(2, false);
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('● 2 tasks');
  });

  test('setTasks(1, false) mostra "● 1 task" (singular)', () => {
    bar = new StatusBar();
    bar.setTasks(1, false);
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('● 1 task');
    expect(line).not.toContain('tasks');
  });

  test('setTasks(0, false) NÃO mostra indicador', () => {
    bar = new StatusBar();
    bar.setModel('gpt-5.2');
    bar.setTasks(0, false);
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).not.toContain('●');
  });

  test('setTasks(3, true) renderiza com warning (substring smoke test)', () => {
    bar = new StatusBar();
    bar.setTasks(3, true);
    const line = bar.render(80, 1)[0];
    const stripped = stripAnsi(line);
    expect(stripped).toContain('● 3 tasks');
    // Smoke test: cor warning (234;179;8) presente no ANSI raw
    expect(line).toContain('234;179;8');
  });

  test('handleMouse com taskRunning > 0 dispara onTaskIndicatorClick', () => {
    bar = new StatusBar();
    bar.setTasks(2, false);
    let clicked = false;
    bar.onTaskIndicatorClick = () => { clicked = true; };
    const consumed = bar.handleMouse({ x: 10, y: 1, button: 0, isRelease: false });
    expect(consumed).toBe(true);
    expect(clicked).toBe(true);
  });

  test('handleMouse com taskRunning === 0 retorna false sem chamar callback', () => {
    bar = new StatusBar();
    let clicked = false;
    bar.onTaskIndicatorClick = () => { clicked = true; };
    const consumed = bar.handleMouse({ x: 10, y: 1, button: 0, isRelease: false });
    expect(consumed).toBe(false);
    expect(clicked).toBe(false);
  });

  test('handleMouse ignora eventos de release', () => {
    bar = new StatusBar();
    bar.setTasks(1, false);
    let clicked = false;
    bar.onTaskIndicatorClick = () => { clicked = true; };
    const consumed = bar.handleMouse({ x: 10, y: 1, button: 0, isRelease: true });
    expect(consumed).toBe(false);
    expect(clicked).toBe(false);
  });
});
