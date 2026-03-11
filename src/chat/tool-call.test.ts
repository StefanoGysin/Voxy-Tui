import { describe, test, expect, afterEach } from 'bun:test';
import { ToolCall } from './tool-call';
import { stripAnsi } from '../utils/strip-ansi';

describe('ToolCall', () => {
  let tool: ToolCall;
  afterEach(() => tool?.dispose());

  test('colapsado por default mostra nome', () => {
    tool = new ToolCall('ReadFile');
    const lines = tool.render(80, 10);
    expect(lines).toHaveLength(1);
    expect(stripAnsi(lines[0])).toContain('ReadFile');
  });

  test('status running mostra frame braille', () => {
    tool = new ToolCall('BashTool');
    const line = stripAnsi(tool.render(80, 10)[0]);
    expect(line).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  test('status done mostra ✓', () => {
    tool = new ToolCall('ReadFile');
    tool.setStatus('done');
    const line = stripAnsi(tool.render(80, 10)[0]);
    expect(line).toContain('✓');
  });

  test('status error mostra ✗', () => {
    tool = new ToolCall('ReadFile');
    tool.setStatus('error');
    const line = stripAnsi(tool.render(80, 10)[0]);
    expect(line).toContain('✗');
  });

  test('expandido mostra input e output', () => {
    tool = new ToolCall('ReadFile');
    tool.setInput('/path/to/file.ts');
    tool.setOutput('export const x = 1;');
    tool.setStatus('done');
    tool.toggle();
    const stripped = tool.render(80, 10).map(stripAnsi).join('\n');
    expect(stripped).toContain('/path/to/file.ts');
    expect(stripped).toContain('export const x = 1;');
  });

  test('toggle colapsa e expande', () => {
    tool = new ToolCall('BashTool');
    tool.setInput('ls -la');
    tool.setStatus('done');
    expect(tool.render(80, 10)).toHaveLength(1);
    tool.toggle();
    expect(tool.render(80, 10).length).toBeGreaterThan(1);
    tool.toggle();
    expect(tool.render(80, 10)).toHaveLength(1);
  });

  test('handleKey Enter faz toggle', () => {
    tool = new ToolCall('Test');
    tool.setInput('data');
    tool.setStatus('done');
    const before = tool.render(80, 10).length;
    tool.handleKey({ key: 'return', ctrl: false, meta: false, shift: false, raw: '\r' });
    expect(tool.render(80, 10).length).not.toBe(before);
  });

  test('dispose não lança erros', () => {
    tool = new ToolCall('Test');
    expect(() => tool.dispose()).not.toThrow();
  });

  test('dispose pode ser chamado duas vezes sem erro', () => {
    tool = new ToolCall('Test');
    tool.dispose();
    expect(() => tool.dispose()).not.toThrow();
  });
});
