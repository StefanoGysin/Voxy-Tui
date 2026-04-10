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
    expect(line).toContain('11k / 200k');
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
    expect(line).toContain('11k / 200k');
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
});
