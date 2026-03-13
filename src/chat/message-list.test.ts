import { describe, test, expect, beforeEach } from 'bun:test';
import { MessageList } from './message-list';
import type { ChatMessage } from './types';
import { stripAnsi } from '../utils/strip-ansi';

function makeMsg(id: string, role: ChatMessage['role'], content: string): ChatMessage {
  return { id, role, content, timestamp: new Date('2025-01-01T10:00:00') };
}

describe('MessageList', () => {
  let list: MessageList;
  beforeEach(() => { list = new MessageList(); });

  test('render vazio retorna linhas de padding', () => {
    const lines = list.render(80, 5);
    expect(lines).toHaveLength(5);
    expect(lines.every(l => l === '')).toBe(true);
  });

  test('addMessage adiciona mensagem user e renderiza header', () => {
    list.addMessage(makeMsg('1', 'user', 'Hello'));
    const lines = list.render(80, 10);
    const joined = lines.join('\n');
    const stripped = stripAnsi(joined);
    expect(stripped).toContain('● You');
    expect(stripped).toContain('Hello');
  });

  test('addMessage adiciona mensagem assistant', () => {
    list.addMessage(makeMsg('1', 'assistant', 'Hi there'));
    const lines = list.render(80, 10);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('◆ Assistant');
    expect(stripped).toContain('Hi there');
  });

  test('updateLastMessage atualiza conteúdo da última mensagem', () => {
    list.addMessage(makeMsg('1', 'assistant', 'Hello'));
    list.updateLastMessage('Hello world');
    const lines = list.render(80, 10);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('Hello world');
  });

  test('render retorna exatamente height linhas', () => {
    list.addMessage(makeMsg('1', 'user', 'A'));
    list.addMessage(makeMsg('2', 'assistant', 'B'));
    const lines = list.render(80, 6);
    expect(lines).toHaveLength(6);
  });

  test('scrollUp / scrollDown funcionam', () => {
    for (let i = 0; i < 5; i++) {
      list.addMessage(makeMsg(String(i), 'user', `Message ${i}`));
    }
    const before = list.render(80, 4).join('\n');
    list.scrollUp(2);
    const after = list.render(80, 4).join('\n');
    expect(before).not.toBe(after);
    list.scrollToBottom();
    const bottom = list.render(80, 4).join('\n');
    expect(bottom).toBe(before);
  });

  test('conteúdo multi-linha é wrappado', () => {
    list.addMessage(makeMsg('1', 'user', 'line one\nline two'));
    const lines = list.render(80, 10);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('line one');
    expect(stripped).toContain('line two');
  });

  test('clear remove todas as mensagens', () => {
    list.addMessage(makeMsg('1', 'user', 'Hello'));
    list.clear();
    const lines = list.render(80, 5);
    expect(stripAnsi(lines.join('')).trim()).toBe('');
  });
});

describe('MessageList — tool messages', () => {
  let list: MessageList;
  beforeEach(() => { list = new MessageList(); });

  test('addToolMessage adiciona mensagem com role tool', () => {
    list.addToolMessage('1', 'Bash', 'cmd: date', ['Fri, Mar 13'], 'done');
    const lines = list.render(80, 10);
    const joined = stripAnsi(lines.join('\n'));
    expect(joined).toContain('Bash');
    expect(joined).toContain('cmd: date');
    expect(joined).toContain('Fri, Mar 13');
  });

  test('render retorna exatamente height linhas com tool message', () => {
    list.addToolMessage('1', 'Bash', 'cmd: date', ['output'], 'done');
    expect(list.render(80, 15)).toHaveLength(15);
  });

  test('tool done mostra ✓', () => {
    list.addToolMessage('1', 'Read', 'file_path: a.ts', [], 'done');
    const joined = stripAnsi(list.render(80, 10).join('\n'));
    expect(joined).toContain('✓');
  });

  test('tool error mostra ✗', () => {
    list.addToolMessage('1', 'Bash', 'cmd: x', ['not found'], 'error');
    const joined = stripAnsi(list.render(80, 10).join('\n'));
    expect(joined).toContain('✗');
  });

  test('output grande é colapsado por default (3 linhas visíveis)', () => {
    const output = ['a', 'b', 'c', 'd', 'e', 'f'];
    list.addToolMessage('1', 'Bash', 'cmd: ls', output, 'done');
    const joined = stripAnsi(list.render(80, 20).join('\n'));
    expect(joined).toContain('a');
    expect(joined).toContain('b');
    expect(joined).toContain('c');
    const dIndex = joined.split('\n').findIndex(l => l.trim() === 'd');
    expect(dIndex).toBe(-1);
    expect(joined).toContain('linhas ocultas');
  });

  test('output pequeno (≤ 3) não mostra hint de truncamento', () => {
    list.addToolMessage('1', 'Bash', 'cmd: date', ['Fri, Mar 13'], 'done');
    const joined = stripAnsi(list.render(80, 10).join('\n'));
    expect(joined).not.toContain('linhas ocultas');
    expect(joined).not.toContain('ctrl+e');
  });

  test('output grande mostra hint ctrl+e', () => {
    const output = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    list.addToolMessage('1', 'Bash', 'cmd: ls', output, 'done');
    const joined = stripAnsi(list.render(80, 30).join('\n'));
    expect(joined).toContain('ctrl+e');
  });

  test('toggleLastTruncatedTool expande output', () => {
    const output = ['a', 'b', 'c', 'd', 'e'];
    list.addToolMessage('1', 'Bash', 'cmd: ls', output, 'done');
    const toggled = list.toggleLastTruncatedTool();
    expect(toggled).toBe(true);
    const joined = stripAnsi(list.render(80, 20).join('\n'));
    expect(joined).toContain('d');
    expect(joined).toContain('e');
    expect(joined).not.toContain('linhas ocultas');
  });

  test('toggleLastTruncatedTool recolhe após expand', () => {
    const output = ['a', 'b', 'c', 'd', 'e'];
    list.addToolMessage('1', 'Bash', 'cmd: ls', output, 'done');
    list.toggleLastTruncatedTool();
    list.toggleLastTruncatedTool();
    const joined = stripAnsi(list.render(80, 20).join('\n'));
    expect(joined).toContain('linhas ocultas');
  });

  test('toggleLastTruncatedTool retorna false sem tools truncadas', () => {
    list.addToolMessage('1', 'Bash', 'cmd: date', ['single line'], 'done');
    expect(list.toggleLastTruncatedTool()).toBe(false);
  });

  test('toggleLastTruncatedTool age na tool mais recente', () => {
    const output = ['a', 'b', 'c', 'd', 'e'];
    list.addToolMessage('1', 'Bash', 'cmd: ls', output, 'done');
    list.addToolMessage('2', 'Read', 'file: a.ts', output, 'done');
    list.toggleLastTruncatedTool();
    const msgs = (list as any).messages as ChatMessage[];
    expect(msgs[0].toolCollapsed).toBe(true);
    expect(msgs[1].toolCollapsed).toBe(false);
  });
});

describe('MessageList — scroll indicator', () => {
  function makeMany(list: MessageList, n: number): void {
    for (let i = 0; i < n; i++) {
      list.addMessage({ id: `${i}`, role: 'user', content: `msg ${i}`, timestamp: new Date() });
    }
  }

  test('sem scroll: primeira linha NÃO é indicador', () => {
    const list = new MessageList();
    makeMany(list, 20);
    const lines = list.render(80, 10);
    expect(stripAnsi(lines[0])).not.toContain('linhas acima');
  });

  test('com scroll: primeira linha É o indicador', () => {
    const list = new MessageList();
    makeMany(list, 20);
    list.scrollUp(5);
    const lines = list.render(80, 10);
    expect(stripAnsi(lines[0])).toContain('linhas acima');
  });

  test('getScrollOffset() retorna 0 inicialmente', () => {
    const list = new MessageList();
    expect(list.getScrollOffset()).toBe(0);
  });

  test('getScrollOffset() retorna offset após scrollUp', () => {
    const list = new MessageList();
    makeMany(list, 20);
    list.scrollUp(5);
    expect(list.getScrollOffset()).toBe(5);
  });
});

describe('MessageList — scrollbar', () => {
  function makeMany(list: MessageList, n: number): void {
    for (let i = 0; i < n; i++) {
      list.addMessage({ id: `${i}`, role: 'user', content: `msg ${i}`, timestamp: new Date() });
    }
  }

  test('sem overflow: sem scrollbar (última coluna não é █ nem ░)', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'user', content: 'curto', timestamp: new Date() });
    const lines = list.render(20, 10);
    const contentLines = lines.filter(l => stripAnsi(l).trim() !== '');
    for (const line of contentLines) {
      const stripped = stripAnsi(line);
      const last = [...stripped].at(-1) ?? '';
      expect(last).not.toBe('█');
      expect(last).not.toBe('░');
    }
  });

  test('com overflow: todas as linhas têm scrollbar (█ ou ░) na última coluna', () => {
    const list = new MessageList();
    makeMany(list, 30);
    const lines = list.render(40, 10);
    expect(lines).toHaveLength(10);
    for (const line of lines) {
      const stripped = stripAnsi(line);
      const last = [...stripped].at(-1) ?? '';
      expect(['█', '░']).toContain(last);
    }
  });

  test('com overflow: thumb (█) aparece na parte inferior quando scrollOffset=0', () => {
    const list = new MessageList(); // scrollOffset=0 = fundo (sticky)
    makeMany(list, 30);
    const lines = list.render(40, 10);
    const scrollChars = lines.map(l => [...stripAnsi(l)].at(-1) ?? '');
    // Alguma linha inferior deve ser thumb
    const thumbLines = scrollChars.map((c, i) => ({ c, i })).filter(x => x.c === '█');
    expect(thumbLines.length).toBeGreaterThan(0);
    // O thumb deve estar na parte inferior da viewport (último terço)
    const avgThumbPos = thumbLines.reduce((a, b) => a + b.i, 0) / thumbLines.length;
    expect(avgThumbPos).toBeGreaterThan(5); // > metade de 10
  });

  test('com overflow: thumb sobe quando scrollUp()', () => {
    const list = new MessageList();
    makeMany(list, 30);

    const linesBottom = list.render(40, 10);
    const thumbBottom = linesBottom.reduce((acc, l, i) =>
      [...stripAnsi(l)].at(-1) === '█' ? i : acc, -1);

    list.scrollUp(10);
    const linesUp = list.render(40, 10);
    const thumbUp = linesUp.reduce((acc, l, i) =>
      [...stripAnsi(l)].at(-1) === '█' ? i : acc, -1);

    // Após scroll para cima, thumb deve estar mais alto (índice menor)
    expect(thumbUp).toBeLessThan(thumbBottom);
  });
});
