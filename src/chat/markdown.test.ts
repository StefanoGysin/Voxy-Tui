import { describe, test, expect, beforeEach } from 'bun:test';
import { Markdown } from './markdown';
import { stripAnsi } from '../utils/strip-ansi';

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
