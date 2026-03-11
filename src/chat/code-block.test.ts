import { describe, test, expect } from 'bun:test';
import { CodeBlock, highlightCode } from './code-block';
import { stripAnsi } from '../utils/strip-ansi';

describe('CodeBlock', () => {
  test('render sem linguagem não mostra cabeçalho', () => {
    const block = new CodeBlock('const x = 1;');
    const lines = block.render(80, 10);
    const stripped = lines.map(stripAnsi).join('\n');
    expect(stripped).not.toContain('──');
    expect(stripped).toContain('const x = 1;');
  });

  test('render com linguagem mostra cabeçalho', () => {
    const block = new CodeBlock('const x = 1;', 'typescript');
    const lines = block.render(80, 10);
    const stripped = lines.map(stripAnsi).join('\n');
    expect(stripped).toContain('typescript');
    expect(stripped).toContain('const x = 1;');
  });

  test('linhas têm 2 espaços de indentação', () => {
    const block = new CodeBlock('hello', 'plaintext');
    const lines = block.render(80, 10);
    const codeLine = lines[lines.length - 1];
    expect(stripAnsi(codeLine)).toMatch(/^ {2}/);
  });

  test('setContent e setLang atualizam o conteúdo', () => {
    const block = new CodeBlock();
    block.setContent('print("hello")');
    block.setLang('python');
    const lines = block.render(80, 10);
    const stripped = lines.map(stripAnsi).join('\n');
    expect(stripped).toContain('python');
    expect(stripped).toContain('print');
  });

  test('highlightCode não crasha com linguagem desconhecida', () => {
    expect(() => highlightCode('some code', 'unknownlang999')).not.toThrow();
  });

  test('highlightCode produz ANSI com custom theme', () => {
    const result = highlightCode('const x = 1;', 'typescript');
    expect(result).toContain('\x1b[');
  });

  test('highlightCode com string vazia não crasha', () => {
    expect(() => highlightCode('', 'typescript')).not.toThrow();
  });
});
