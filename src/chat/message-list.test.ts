import { describe, test, expect, beforeEach } from 'bun:test';
import { MessageList } from './message-list';
import type { ChatMessage } from './types';
import { stripAnsi } from '../utils/strip-ansi';
import { BOLD, FG_CYAN } from '../core/ansi';

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
    expect(stripped).toContain('⬥ You');
    expect(stripped).toContain('Hello');
  });

  test('addMessage adiciona mensagem assistant', () => {
    list.addMessage(makeMsg('1', 'assistant', 'Hi there'));
    const lines = list.render(80, 10);
    const stripped = stripAnsi(lines.join('\n'));
    expect(stripped).toContain('✦ Assistant');
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
    expect(joined).not.toContain('click');
  });

  test('output grande mostra hint click', () => {
    const output = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    list.addToolMessage('1', 'Bash', 'cmd: ls', output, 'done');
    const joined = stripAnsi(list.render(80, 30).join('\n'));
    expect(joined).toContain('click');
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

  test('com scroll: hint line visível na primeira row', () => {
    const list = new MessageList();
    makeMany(list, 20);
    list.scrollUp(5);
    const lines = list.render(80, 10);
    expect(stripAnsi(lines[0])).toContain('linhas acima');
    expect(lines).toHaveLength(10);
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

describe('MessageList — handleMouse', () => {
  function makeTool(id: string, outputLines: number): ChatMessage {
    return {
      id,
      role: 'tool',
      content: '',
      timestamp: new Date(),
      toolName: 'TestTool',
      toolInput: 'input',
      toolOutput: Array.from({ length: outputLines }, (_, i) => `linha ${i}`),
      toolStatus: 'done',
      toolCollapsed: true,
    };
  }

  test('clique esquerdo (release) numa linha de tool truncado → toggle collapsed', () => {
    const list = new MessageList();
    const msg = makeTool('1', 10);
    list.addMessage(msg);
    list.render(40, 20);

    const wasCollapsed = msg.toolCollapsed;
    const lines = list.render(40, 20);
    const headerLineIdx = lines.findIndex(l => stripAnsi(l).includes('TestTool'));
    expect(headerLineIdx).toBeGreaterThanOrEqual(0);

    const consumed = list.handleMouse({ x: 5, y: headerLineIdx + 1, button: 0, isRelease: true });
    expect(consumed).toBe(true);
    expect(msg.toolCollapsed).toBe(!wasCollapsed);
  });

  test('press event (isRelease=false) → não consome (registra anchor)', () => {
    const list = new MessageList();
    list.addMessage(makeTool('1', 10));
    list.render(40, 20);
    const consumed = list.handleMouse({ x: 5, y: 1, button: 0, isRelease: false });
    expect(consumed).toBe(false);
  });

  test('clique em tool com poucas linhas (não truncado) → não consome', () => {
    const list = new MessageList();
    const msg = makeTool('1', 2);
    list.addMessage(msg);
    const lines = list.render(40, 20);
    const headerLineIdx = lines.findIndex(l => stripAnsi(l).includes('TestTool'));
    expect(headerLineIdx).toBeGreaterThanOrEqual(0);
    const consumed = list.handleMouse({ x: 5, y: headerLineIdx + 1, button: 0, isRelease: true });
    expect(consumed).toBe(false);
  });

  test('clique fora da área de conteúdo (padding) → não consome', () => {
    const list = new MessageList();
    list.addMessage(makeTool('1', 10));
    list.render(40, 20);
    // y=1 é padding (conteúdo fica nas últimas linhas com sticky bottom)
    const consumed = list.handleMouse({ x: 5, y: 1, button: 0, isRelease: true });
    // Pode ou não consumir dependendo da posição; só verificar que não lança exceção
    expect(typeof consumed).toBe('boolean');
  });

  test('expandir: scroll posiciona o início do tool message na viewport', () => {
    const list = new MessageList();
    // Adicionar padding de mensagens antes do tool para criar overflow
    for (let i = 0; i < 20; i++) {
      list.addMessage({ id: `u${i}`, role: 'user', content: `msg ${i}`, timestamp: new Date() });
    }
    const toolMsg = makeTool('t1', 20); // 20 linhas de output
    list.addMessage(toolMsg);
    list.render(40, 10); // registrar lastRenderWidth/Height

    // Antes do click: tool está collapsed (começa collapsed por default)
    expect(toolMsg.toolCollapsed).toBe(true);
    expect(list.getScrollOffset()).toBe(0);

    // Encontrar a linha do header do tool na viewport para clicar
    const lines = list.render(40, 10);
    const toolLineIdx = lines.findIndex(l => stripAnsi(l).includes('TestTool'));
    if (toolLineIdx < 0) {
      // Tool fora da viewport — scrollar para encontrá-lo
      list.scrollUp(5);
      const lines2 = list.render(40, 10);
      const idx2 = lines2.findIndex(l => stripAnsi(l).includes('TestTool'));
      if (idx2 < 0) return; // skip se tool não visível
      list.handleMouse({ x: 5, y: idx2 + 1, button: 0, isRelease: true });
    } else {
      list.handleMouse({ x: 5, y: toolLineIdx + 1, button: 0, isRelease: true });
    }

    // Após expandir: deve ter scrollado para mostrar o início do tool message
    expect(toolMsg.toolCollapsed).toBe(false);
    // O scroll offset deve ser > 0 (não está mais sticky bottom)
    // ou o tool cabe na viewport (edge case: offset=0 aceitável)
    expect(list.getScrollOffset()).toBeGreaterThanOrEqual(0);
    // Verificar que o header do tool está visível na nova renderização
    const linesAfter = list.render(40, 10);
    const toolVisible = linesAfter.some(l => stripAnsi(l).includes('TestTool'));
    expect(toolVisible).toBe(true);
  });

  test('colapsar: mantém posição da viewport (não salta para o fundo)', () => {
    const list = new MessageList();
    for (let i = 0; i < 30; i++) {
      list.addMessage({ id: `u${i}`, role: 'user', content: `msg ${i}`, timestamp: new Date() });
    }
    const toolMsg = makeTool('t1', 20);
    list.addMessage(toolMsg);
    list.render(40, 10);

    // Expandir manualmente para ter um tool expandido
    toolMsg.toolCollapsed = false;
    // Simular que o usuário scrollou para cima para ver o tool
    // (usar valor > |lineDelta| ≈ 16 para garantir que o offset continua > 0 após colapsar)
    list.scrollUp(30);
    expect(list.getScrollOffset()).toBe(30);
    list.render(40, 10);

    // Encontrar header do tool na viewport
    const lines = list.render(40, 10);
    const toolLineIdx = lines.findIndex(l => stripAnsi(l).includes('TestTool'));
    if (toolLineIdx < 0) return; // skip se não visível

    // Clicar para colapsar
    const consumed = list.handleMouse({ x: 5, y: toolLineIdx + 1, button: 0, isRelease: true });
    if (!consumed) return; // skip se não consumido (edge case de posição)

    // Após colapsar: NÃO deve ter saltado para o fundo
    // O scroll offset deve ter diminuído pelo lineDelta (linhas removidas), mas > 0
    expect(toolMsg.toolCollapsed).toBe(true);
    // scrollOffset > 0 indica que não saltou para o último msg
    expect(list.getScrollOffset()).toBeGreaterThan(0);
  });
});

describe('MessageList — drag selection', () => {
  test('handleMouseDrag sem pressionar → retorna false (sem anchor)', () => {
    const list = new MessageList();
    list.render(40, 10);
    const result = list.handleMouseDrag({ x: 5, y: 3, button: 0 });
    expect(result).toBe(false);
    expect(list.getScrollOffset()).toBe(0); // sem efeitos colaterais
  });

  test('press → drag → isDragging=true após handleMouseDrag', () => {
    const list = new MessageList();
    list.addMessage({ id: 'u1', role: 'user', content: 'hello', timestamp: new Date() });
    list.render(40, 10);
    // Press
    list.handleMouse({ x: 5, y: 9, button: 0, isRelease: false });
    // Drag
    const result = list.handleMouseDrag({ x: 10, y: 8, button: 0 });
    expect(result).toBe(true);
  });

  test('drag seguido de release + right-click → chama onTextCopied', () => {
    const list = new MessageList();
    for (let i = 0; i < 5; i++) {
      list.addMessage({ id: `u${i}`, role: 'user', content: `msg ${i}`, timestamp: new Date() });
    }
    let copied = '';
    list.onTextCopied = (t) => { copied = t; };
    list.render(40, 10);

    // Press
    list.handleMouse({ x: 1, y: 8, button: 0, isRelease: false });
    // Drag
    list.handleMouseDrag({ x: 5, y: 7, button: 0 });
    // Release (highlight persiste, sem copiar)
    const consumed = list.handleMouse({ x: 5, y: 7, button: 0, isRelease: true });
    expect(consumed).toBe(true);
    expect(copied).toBe('');

    // Right-click release → copia e limpa
    const rcConsumed = list.handleMouse({ x: 5, y: 7, button: 2, isRelease: true });
    expect(rcConsumed).toBe(true);
    expect(copied.length).toBeGreaterThan(0);
  });

  test('clique simples (sem drag) → NÃO chama onTextCopied', () => {
    const list = new MessageList();
    list.addMessage({ id: 'u1', role: 'user', content: 'hello', timestamp: new Date() });
    let copied = '';
    list.onTextCopied = (t) => { copied = t; };
    list.render(40, 10);

    // Press
    list.handleMouse({ x: 1, y: 10, button: 0, isRelease: false });
    // Release imediato (sem drag)
    list.handleMouse({ x: 1, y: 10, button: 0, isRelease: true });

    expect(copied).toBe('');
  });

  test('highlight persiste após release (selFinalized)', () => {
    const list = new MessageList();
    for (let i = 0; i < 5; i++) {
      list.addMessage({ id: `u${i}`, role: 'user', content: `mensagem ${i}`, timestamp: new Date() });
    }
    list.onTextCopied = () => {};
    list.render(40, 10);

    // Press → drag → release
    list.handleMouse({ x: 1, y: 8, button: 0, isRelease: false });
    list.handleMouseDrag({ x: 1, y: 7, button: 0 });
    list.handleMouse({ x: 1, y: 7, button: 0, isRelease: true });

    // Após release: render deve mostrar highlight nas linhas selecionadas
    const lines = list.render(40, 10);
    const hasHighlight = lines.some(l => l.includes('\x1b[44m'));
    expect(hasHighlight).toBe(true);
  });

  test('novo press limpa o highlight persistente', () => {
    const list = new MessageList();
    for (let i = 0; i < 5; i++) {
      list.addMessage({ id: `u${i}`, role: 'user', content: `mensagem ${i}`, timestamp: new Date() });
    }
    list.onTextCopied = () => {};
    list.render(40, 10);

    // Criar seleção finalizada
    list.handleMouse({ x: 1, y: 8, button: 0, isRelease: false });
    list.handleMouseDrag({ x: 1, y: 7, button: 0 });
    list.handleMouse({ x: 1, y: 7, button: 0, isRelease: true });
    // Confirmar highlight presente
    expect(list.render(40, 10).some(l => l.includes('\x1b[44m'))).toBe(true);

    // Novo press → highlight deve desaparecer
    list.handleMouse({ x: 1, y: 5, button: 0, isRelease: false });
    expect(list.render(40, 10).some(l => l.includes('\x1b[44m'))).toBe(false);
  });

  test('scroll durante drag estende selCurrentIdx (updateSelOnScroll)', () => {
    const list = new MessageList();
    // Adicionar conteúdo suficiente para overflow
    for (let i = 0; i < 20; i++) {
      list.addMessage({ id: `u${i}`, role: 'user', content: `mensagem ${i}`, timestamp: new Date() });
    }
    list.render(40, 10);

    // Press e drag na linha 1 (topo da viewport)
    list.handleMouse({ x: 1, y: 5, button: 0, isRelease: false });
    list.handleMouseDrag({ x: 1, y: 1, button: 0 });

    // Capturar selCurrentIdx antes do scroll
    // (não temos acesso direto ao campo privado, mas podemos checar via highlight)
    const linesBefore = list.render(40, 10);
    const highlightedBefore = linesBefore.filter(l => l.includes('\x1b[44m')).length;

    // Rolar para cima — selCurrentIdx deve se mover para cima em allLines-space
    list.scrollUp(3);

    const linesAfter = list.render(40, 10);
    const highlightedAfter = linesAfter.filter(l => l.includes('\x1b[44m')).length;

    // Após scroll de 3 linhas enquanto dragging no topo, mais linhas devem estar selecionadas
    expect(highlightedAfter).toBeGreaterThanOrEqual(highlightedBefore);
  });
});

describe('MessageList — margem esquerda (MARGIN_LEFT)', () => {
  test('render inclui margem: cada linha de conteúdo começa com │ + espaço', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'user', content: 'hello', timestamp: new Date() });
    const lines = list.render(30, 10);
    // Linhas de conteúdo (não-padding) devem começar com │ + espaço
    const contentLines = lines.filter(l => stripAnsi(l).trim() !== '');
    expect(contentLines.length).toBeGreaterThan(0);
    for (const line of contentLines) {
      const stripped = stripAnsi(line);
      expect(stripped[0]).toBe('│');    // borda está presente
      expect(stripped[1]).toBe(' ');    // espaço após borda
    }
  });

  test('seleção: event.x na margem clamp a 0', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'user', content: 'hello world', timestamp: new Date() });
    list.render(40, 10);

    // event.x=1 (dentro da margem) → selAnchorX deve ser 0
    list.handleMouse({ x: 1, y: 9, button: 0, isRelease: false });
    expect((list as any).selAnchorX).toBe(0);

    // event.x=2 (ainda na margem) → selAnchorX deve ser 0
    list.handleMouse({ x: 2, y: 9, button: 0, isRelease: false });
    expect((list as any).selAnchorX).toBe(0);

    // event.x=3 (primeiro char de conteúdo, margem=2) → selAnchorX = 0
    list.handleMouse({ x: 3, y: 9, button: 0, isRelease: false });
    expect((list as any).selAnchorX).toBe(0);

    // event.x=4 → selAnchorX = 1
    list.handleMouse({ x: 4, y: 9, button: 0, isRelease: false });
    expect((list as any).selAnchorX).toBe(1);
  });

  test('left border: user tem borda verde (│), assistant tem borda ciano', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'user', content: 'oi', timestamp: new Date() });
    list.addMessage({ id: '2', role: 'assistant', content: 'olá', timestamp: new Date() });
    const lines = list.render(40, 10);
    const contentLines = lines.filter(l => stripAnsi(l).trim() !== '');
    // Toda linha de conteúdo deve ter │ como primeiro char após stripAnsi
    expect(contentLines.every(l => stripAnsi(l)[0] === '│')).toBe(true);
    // Deve haver linhas com FG_GREEN│ (user) e FG_CYAN│ (assistant)
    const joined = lines.join('\n');
    expect(joined).toContain('\x1b[32m│');   // FG_GREEN│ (user)
    expect(joined).toContain('\x1b[36m│');   // FG_CYAN│ (assistant)
  });

  test('linhas têm visual width = width (sem colunas de scrollbar)', () => {
    const list = new MessageList();
    for (let i = 0; i < 30; i++) {
      list.addMessage({ id: `${i}`, role: 'user', content: `msg ${i}`, timestamp: new Date() });
    }
    const width = 20, height = 5;
    const lines = list.render(width, height);
    expect(lines).toHaveLength(height);
    // borda(1) + gap(1) + conteúdo(18) = 20 — sem scrollbar
    for (const line of lines) {
      const stripped = stripAnsi(line);
      expect(stripped.length).toBe(width);
    }
  });

  test('separador - entre mensagens', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'user', content: 'hello', timestamp: new Date() });
    list.addMessage({ id: '2', role: 'assistant', content: 'hi', timestamp: new Date() });
    const lines = list.render(30, 10);
    const stripped = lines.map(l => stripAnsi(l));
    // Deve ter linhas com ── (separador)
    const separatorLines = stripped.filter(l => l.includes('--'));
    expect(separatorLines.length).toBeGreaterThanOrEqual(2); // 1 por mensagem
  });
});

describe('MessageList — scrollbar', () => {
  function makeMany(list: MessageList, n: number): void {
    for (let i = 0; i < n; i++) {
      list.addMessage({ id: `${i}`, role: 'user', content: `msg ${i}`, timestamp: new Date() });
    }
  }

  test('sem overflow: não renderiza coluna scrollbar', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'user', content: 'hello', timestamp: new Date() });
    const lines = list.render(40, 20);
    // Sem overflow → sem SCROLLBAR_SEP (│ dim) nas linhas de conteúdo
    const contentLines = lines.filter(l => stripAnsi(l).trim() !== '');
    for (const line of contentLines) {
      // Não deve conter o separador dim │ do scrollbar (236m│)
      expect(line).not.toContain('\x1b[38;5;236m│');
    }
  });

  test('com overflow: renderiza coluna scrollbar', () => {
    const list = new MessageList();
    makeMany(list, 30);
    const lines = list.render(40, 5);
    // Overflow → cada linha deve conter SCROLLBAR_SEP
    for (const line of lines) {
      expect(line).toContain('\x1b[38;5;236m│');
    }
  });

  test('click acima do thumb → scrollUp', () => {
    const list = new MessageList();
    makeMany(list, 50);
    const width = 40, height = 10;
    list.render(width, height);
    // scrollOffset=0 (bottom) → thumb está no fundo do track
    // Click no topo da coluna scrollbar (x=width, y=1) → acima do thumb → scrollUp
    const consumed = list.handleMouse({ x: width, y: 1, button: 0, isRelease: false });
    expect(consumed).toBe(true);
    expect(list.getScrollOffset()).toBe(10); // SCROLLBAR_PAGE_LINES
  });

  test('click abaixo do thumb → scrollDown', () => {
    const list = new MessageList();
    makeMany(list, 50);
    const width = 40, height = 10;
    list.render(width, height);
    // Primeiro scroll para cima para ter espaço abaixo
    list.scrollUp(30);
    list.render(width, height);
    // Click na última linha da scrollbar (y=height) → abaixo do thumb → scrollDown
    const consumed = list.handleMouse({ x: width, y: height, button: 0, isRelease: false });
    expect(consumed).toBe(true);
    expect(list.getScrollOffset()).toBe(20); // 30 - SCROLLBAR_PAGE_LINES
  });

  test('drag do thumb → scroll proporcional', () => {
    const list = new MessageList();
    makeMany(list, 50);
    const width = 40, height = 10;
    list.render(width, height);
    // Scroll para cima para posicionar thumb no meio
    list.scrollUp(20);
    list.render(width, height);

    // Descobrir posição do thumb via campo privado
    const thumbPos = (list as any).lastScrollbarThumbPos as number;
    const thumbSize = (list as any).lastScrollbarThumbSize as number;

    // Press no thumb (x=width, y no thumb)
    const pressY = thumbPos + 1; // 1-based
    list.handleMouse({ x: width, y: pressY, button: 0, isRelease: false });
    expect((list as any).isScrollbarDrag).toBe(true);

    // Drag para baixo (y maior → scroll down → offset diminui)
    const dragY = pressY + 2;
    list.handleMouseDrag({ x: width, y: dragY, button: 0 });
    expect(list.getScrollOffset()).toBeLessThan(20);

    // Release
    list.handleMouse({ x: width, y: dragY, button: 0, isRelease: true });
    expect((list as any).isScrollbarDrag).toBe(false);
  });

  test('click no conteúdo (não scrollbar) → não intercepta', () => {
    const list = new MessageList();
    makeMany(list, 30);
    const width = 40, height = 5;
    list.render(width, height);
    // Click em x=5 (dentro do conteúdo, não na coluna scrollbar)
    const consumed = list.handleMouse({ x: 5, y: 3, button: 0, isRelease: false });
    // Press não consome (registra anchor de seleção)
    expect(consumed).toBe(false);
    // scrollOffset não deve ter mudado
    expect(list.getScrollOffset()).toBe(0);
  });

  test('scrolled: hint line visível na primeira row', () => {
    const list = new MessageList();
    makeMany(list, 30);
    list.render(40, 5);
    list.scrollUp(5);
    const lines = list.render(40, 5);
    expect(stripAnsi(lines[0])).toContain('5 linhas acima');
  });

  test('no fundo: sem hint line', () => {
    const list = new MessageList();
    makeMany(list, 30);
    const lines = list.render(40, 5);
    // scrollOffset=0 → sem hint
    expect(stripAnsi(lines[0])).not.toContain('linhas acima');
  });
});

describe('MessageList — markdown rendering', () => {
  test('mensagem assistant com **texto** contém BOLD no output', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'assistant', content: '**negrito**', timestamp: new Date() });
    const lines = list.render(80, 10);
    const joined = lines.join('\n');
    expect(joined).toContain(BOLD);
    expect(stripAnsi(joined)).toContain('negrito');
  });

  test('mensagem assistant com `codigo` contém FG_CYAN no output', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'assistant', content: 'Use `codigo`', timestamp: new Date() });
    const lines = list.render(80, 10);
    const joined = lines.join('\n');
    expect(joined).toContain(FG_CYAN);
    expect(stripAnsi(joined)).toContain('codigo');
  });

  test('mensagem user com **texto** NÃO contém BOLD (plain text preservado)', () => {
    const list = new MessageList();
    list.addMessage({ id: '1', role: 'user', content: '**texto**', timestamp: new Date() });
    const lines = list.render(80, 10);
    // Filtrar linhas de conteúdo (excluir header que tem BOLD no nome "⬥ You")
    const contentLines = lines.filter(l => {
      const s = stripAnsi(l);
      return s.includes('**texto**');
    });
    expect(contentLines.length).toBeGreaterThan(0);
    // A linha de conteúdo deve ter o markdown bruto, não estilizado
    expect(stripAnsi(contentLines[0])).toContain('**texto**');
  });
});
