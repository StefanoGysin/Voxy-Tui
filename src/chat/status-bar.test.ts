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

  test('tokens aparecem quando definidos', () => {
    bar = new StatusBar();
    bar.setTokens(1234, 567);
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('1234');
    expect(line).toContain('567');
  });

  test('status text aparece no modo idle', () => {
    bar = new StatusBar();
    bar.setStatus('Ready');
    const line = stripAnsi(bar.render(80, 1)[0]);
    expect(line).toContain('Ready');
  });

  test('render retorna linha com conteúdo', () => {
    bar = new StatusBar();
    bar.setModel('gpt-4o');
    bar.setTokens(100, 50);
    const line = bar.render(60, 1)[0];
    const stripped = stripAnsi(line);
    expect(stripped.length).toBeGreaterThan(0);
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
});
