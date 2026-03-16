import { describe, test, expect, beforeEach } from 'bun:test';
import { Markdown, renderMarkdown } from './markdown';
import { stripAnsi } from '../utils/strip-ansi';
import { BOLD, RESET, FG_CYAN } from '../core/ansi';

describe('Markdown', () => {
  let md: Markdown;
  beforeEach(() => { md = new Markdown(); });

  test('render vazio retorna array vazio', () => {
    expect(md.render(80, 20)).toEqual([]);
  });

  test('heading # renderiza com negrito', () => {
    md.setContent('# Título\n\n');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('# Título');
  });

  test('negrito ** renderiza após bloco completo', () => {
    md.setContent('**negrito**\n\n');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('negrito');
  });

  test('itálico * renderiza após bloco completo', () => {
    md.setContent('*itálico*\n\n');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('itálico');
  });

  test('código inline `backtick`', () => {
    md.setContent('Use `console.log`\n\n');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('console.log');
  });

  test('bloco de código com linguagem', () => {
    md.setContent('Texto\n\n```typescript\nconst x = 1;\n```\n\n');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('typescript');
    expect(stripped).toContain('const x = 1;');
  });

  test('lista de bullets', () => {
    md.setContent('- item 1\n- item 2\n\n');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('item 1');
    expect(stripped).toContain('item 2');
  });

  test('streaming: texto sem \\n\\n mostra como raw', () => {
    md.setContent('**texto incompleto');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('**texto incompleto');
  });

  test('streaming: texto com \\n\\n finaliza primeiro bloco', () => {
    md.setContent('# Título\n\ntexto pendente sem fechar **negr');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('# Título');
    expect(stripped).toContain('texto pendente');
  });

  test('finalize renderiza texto completo', () => {
    md.setContent('**bold**');
    md.finalize();
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('bold');
  });

  test('hr renderiza linha horizontal', () => {
    md.setContent('---\n\n');
    const lines = md.render(80, 20);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('─');
  });
});

describe('renderMarkdown', () => {
  test('texto simples retorna linhas wrapped', () => {
    const lines = renderMarkdown('hello world', 80);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('hello world');
    expect(lines.length).toBeGreaterThan(0);
  });

  test('**bold** retorna linha com BOLD + RESET', () => {
    const lines = renderMarkdown('**negrito**', 80);
    const joined = lines.join('\n');
    expect(joined).toContain(BOLD);
    expect(joined).toContain(RESET);
    expect(stripAnsi(joined)).toContain('negrito');
  });

  test('`code span` retorna linha com FG_CYAN', () => {
    const lines = renderMarkdown('Use `console.log`', 80);
    const joined = lines.join('\n');
    expect(joined).toContain(FG_CYAN);
    expect(stripAnsi(joined)).toContain('console.log');
  });

  test('## Heading retorna linha com BOLD prefix', () => {
    const lines = renderMarkdown('## Título', 80);
    const joined = lines.join('\n');
    expect(joined).toContain(BOLD);
    expect(stripAnsi(joined)).toContain('## Título');
  });

  test('lista com itens retorna linhas com bullets (•)', () => {
    const lines = renderMarkdown('- item 1\n- item 2', 80);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('•');
    expect(stripped).toContain('item 1');
    expect(stripped).toContain('item 2');
  });

  test('code block retorna linhas com indentação', () => {
    const lines = renderMarkdown('```js\nconst x = 1;\n```', 80);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('const x = 1;');
    // Code block lines are indented with 2 spaces
    const codeLine = lines.find(l => stripAnsi(l).includes('const x'));
    expect(codeLine).toBeDefined();
    expect(codeLine!.startsWith('  ')).toBe(true);
  });
});
