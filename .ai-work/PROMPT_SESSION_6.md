# Sessão 6 — Chat Kit: MessageList, InputBar, StatusBar, ChatLayout

## Contexto do projeto

`voxy-tui` é uma biblioteca TUI TypeScript para agentes LLM CLI. Paradigma imperativo — sem React, sem Ink.

**Estado atual após Sessão 5 (61 testes passando):**
- `src/core/`: `component.ts`, `ansi.ts`, `terminal.ts`, `renderer.ts`, `scheduler.ts`
- `src/components/`: `Text`, `Spinner`, `TextInput`, `Border`, `Scrollable` (placeholder)
- `src/layout/`: `Stack` (vertical + horizontal)
- `src/utils/`: `wrapText`, `truncate`, `stripAnsi`, `measureWidth`, `parseKey`
- `src/chat/`: 8 arquivos placeholder — transformar 4 deles em implementações reais nesta sessão

## Objetivo da Sessão 6

Implementar os 4 componentes fundamentais do Chat Kit:

1. `src/chat/types.ts` — **NOVO** — tipos compartilhados
2. `src/chat/message-list.ts` — **SUBSTITUIR placeholder** — lista de mensagens com scroll
3. `src/chat/input-bar.ts` — **SUBSTITUIR placeholder** — barra de input com separador
4. `src/chat/status-bar.ts` — **SUBSTITUIR placeholder** — barra de status com spinner e tokens
5. `src/chat/chat-layout.ts` — **SUBSTITUIR placeholder** — compositor dos 3 componentes acima
6. `src/chat/index.ts` — **ATUALIZAR** — adicionar export do tipo `ChatMessage`
7. Testes: 4 arquivos de teste novos

**NÃO alterar:** `tool-call.ts`, `markdown.ts`, `code-block.ts`, `thinking-block.ts` (ficam como placeholder — Sessão 7).

---

## APIs de dependências (verificadas nos arquivos reais)

```typescript
// Spinner — construtor positional (NÃO options object):
new Spinner(label: string = '', onUpdate?: () => void)
spinner.start(label?: string): void    // inicia animação
spinner.stop(): void                    // para animação
spinner.setLabel(label: string): void
spinner.render(width, height): string[] // [] quando inativo

// exports de spinner.ts:
export const BRAILLE_FRAMES: readonly string[]  // 10 frames braille
export const FRAME_INTERVAL_MS = 80

// TextInput:
new TextInput(options?: TextInputOptions)
input.getValue(): string
input.setValue(text: string): void
input.clear(): void
input.onFocus(): void
input.onBlur(): void
input.minHeight(): number   // === lines.length
input.handleKey(event: KeyEvent): boolean
input.render(width, height): string[]
input.onSubmit?: (text: string) => void
input.onChange?: (text: string) => void

// wrapText — de ../utils/wrap:
wrapText(text: string, width: number): string[]
// Respeita \n internos, quebra por palavras, hard-break para palavras > width

// ANSI — de ../core/ansi (todos exportados):
RESET, BOLD, DIM, ITALIC, FG_CYAN, FG_GREEN, FG_YELLOW, FG_GRAY, FG_RED, FG_WHITE
measureWidth(text: string): number  // de ../utils/width
stripAnsi(text: string): string      // de ../utils/strip-ansi
```

---

## 1. `src/chat/types.ts` — NOVO

```typescript
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
}
```

---

## 2. `src/chat/message-list.ts`

**Requisitos:**
- Implementa `Component`
- Mantém lista interna de `ChatMessage[]`
- Scroll embutido (sem depender do `Scrollable` placeholder)
- `scrollOffset`: quantas linhas do fundo estão ocultas (0 = stick to bottom)
- `stickyBottom`: auto-scroll ao adicionar/atualizar mensagem

**API pública:**
```typescript
addMessage(message: ChatMessage): void
updateLastMessage(content: string): void
scrollUp(lines?: number): void    // default 1
scrollDown(lines?: number): void  // default 1
scrollToBottom(): void
clear(): void
```

**Render:**
- Renderiza cada mensagem com `renderMessage(msg, width): string[]`
- Header: `role` colorido + timestamp no formato HH:MM
  - `user` → `FG_GREEN + BOLD + "● You"` + espaço + `FG_GRAY + DIM + time`
  - `assistant` → `FG_CYAN + BOLD + "◆ Assistant"` + espaço + `FG_GRAY + DIM + time`
  - `system` → `FG_GRAY + ITALIC + "◇ System"` + espaço + `FG_GRAY + DIM + time`
- Conteúdo: `wrapText(message.content, width)` (já trata `\n` internos)
- Separador: linha vazia `''` após cada mensagem
- Se `allLines.length <= height`: padding com linhas vazias no topo
- Se `allLines.length > height`: fatiar `[end - height, end)` onde `end = allLines.length - scrollOffset`
- `scrollUp` incrementa `scrollOffset`, seta `stickyBottom = false`
- `scrollDown` decrementa `scrollOffset` (min 0), se `scrollOffset === 0` seta `stickyBottom = true`

**Formato timestamp:**
```typescript
function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
```

---

## 3. `src/chat/input-bar.ts`

**Requisitos:**
- Implementa `Component`
- Encapsula um `TextInput` internamente
- Adiciona 1 linha de separador acima do input
- `focusable = true`

**API pública:**
```typescript
new InputBar(options?: InputBarOptions)  // extends TextInputOptions, + separatorChar?: string (default '─')
getValue(): string
clear(): void
onFocus(): void     // delega ao TextInput interno
onBlur(): void      // delega ao TextInput interno
handleKey(event: KeyEvent): boolean  // delega ao TextInput interno
minHeight(): number  // TextInput.minHeight() + 1 (pelo separador)
onSubmit?: (text: string) => void  // callback
onChange?: (text: string) => void  // callback
```

**Render:**
```typescript
render(width: number, height: number): string[] {
  // 1. Separador: FG_GRAY + separatorChar.repeat(width) + RESET
  // 2. Input: TextInput.render(width, Math.max(1, height - 1))
  // retorna [separator, ...inputLines]
}
```

**Construtor:**
```typescript
constructor(options: InputBarOptions = {}) {
  const { separatorChar = '─', ...inputOptions } = options;
  this.separatorChar = separatorChar;
  this.input = new TextInput(inputOptions);
  this.input.onSubmit = (text) => this.onSubmit?.(text);
  this.input.onChange = (text) => this.onChange?.(text);
}
```

---

## 4. `src/chat/status-bar.ts`

**Requisitos:**
- Implementa `Component`
- Sempre renderiza exatamente 1 linha
- Gerencia seu próprio timer de animação (importa `BRAILLE_FRAMES`, `FRAME_INTERVAL_MS` de `../components/spinner`)
- `onUpdate?: () => void` — chamado quando o frame muda (para o ChatLayout agendar re-render)

**Tipos:**
```typescript
export type StatusMode = 'idle' | 'streaming' | 'thinking' | 'error';
```

**API pública:**
```typescript
setMode(mode: StatusMode): void
setModel(name: string): void
setStatus(text: string): void
setTokens(input: number, output: number): void
dispose(): void   // para o timer (para evitar leaks em testes)
minHeight(): number  // sempre retorna 1
onUpdate?: () => void
```

**Comportamento:**
- `setMode('streaming')` ou `setMode('thinking')` → inicia timer se não estiver ativo
- `setMode('idle')` ou `setMode('error')` → para o timer
- Timer: `setInterval(() => { frameIndex++; onUpdate?.(); }, FRAME_INTERVAL_MS)`

**Render:**
```typescript
render(width: number, _height: number): string[] {
  // Seção esquerda:
  //   mode='streaming'|'thinking' → "${FG_YELLOW}${BRAILLE_FRAMES[frameIndex]}${RESET} ${status || 'Generating…'}"
  //   mode='error' → "${FG_RED}✗${RESET} ${status}"
  //   mode='idle' + status não-vazio → "${FG_GRAY}${status}${RESET}"
  //   mode='idle' + status vazio → ""

  // Seção direita:
  //   model não-vazio → "${FG_CYAN}${model}${RESET}"
  //   tokens > 0 → " ${FG_GRAY}↑${inputTokens} ↓${outputTokens}${RESET}" (anexar ao model)

  // Padding central: ' '.repeat(Math.max(1, width - leftWidth - rightWidth))
  // Retorna [left + padding + right]
}
```

---

## 5. `src/chat/chat-layout.ts`

**Requisitos:**
- Implementa `Component`
- Compositor dos 3 componentes: `MessageList`, `InputBar`, `StatusBar`
- Expõe os 3 como propriedades públicas readonly para o caller poder chamar `.addMessage()`, `.setModel()`, etc.

**Construção:**
```typescript
constructor() {
  this.messageList = new MessageList();
  this.inputBar = new InputBar({ placeholder: 'Type a message…' });
  this.statusBar = new StatusBar();
}
```

**Render:**
```typescript
render(width: number, height: number): string[] {
  const statusHeight = 1;
  const inputHeight = Math.max(this.inputBar.minHeight(), 2); // mínimo 2 linhas (separador + 1 linha input)
  const messagesHeight = Math.max(0, height - statusHeight - inputHeight);

  const messageLines = this.messageList.render(width, messagesHeight);
  const inputLines = this.inputBar.render(width, inputHeight);
  const statusLines = this.statusBar.render(width, statusHeight);

  return [...messageLines, ...inputLines, ...statusLines];
}
```

**Outros métodos:**
```typescript
handleKey(event: KeyEvent): boolean {
  return this.inputBar.handleKey(event);
}

minHeight(): number {
  return this.inputBar.minHeight() + this.statusBar.minHeight() + 3;
}
```

---

## 6. `src/chat/index.ts` — ATUALIZAR

Adicionar export do novo tipo `ChatMessage`:

```typescript
export type { ChatMessage, MessageRole } from './types';
export { MessageList } from './message-list';
export { InputBar } from './input-bar';
export { StatusBar } from './status-bar';
export { ToolCall } from './tool-call';
export { Markdown } from './markdown';
export { CodeBlock } from './code-block';
export { ChatLayout } from './chat-layout';
export { ThinkingBlock } from './thinking-block';
```

---

## 7. Testes

### `src/chat/message-list.test.ts`

```typescript
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
    expect(stripped).not.toContain('Hello\n');
  });

  test('render retorna exatamente height linhas', () => {
    list.addMessage(makeMsg('1', 'user', 'A'));
    list.addMessage(makeMsg('2', 'assistant', 'B'));
    const lines = list.render(80, 6);
    expect(lines).toHaveLength(6);
  });

  test('scrollUp / scrollDown funcionam', () => {
    // Adicionar mensagens suficientes para overflow
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
```

### `src/chat/input-bar.test.ts`

```typescript
import { describe, test, expect, beforeEach } from 'bun:test';
import { InputBar } from './input-bar';
import { stripAnsi } from '../utils/strip-ansi';

describe('InputBar', () => {
  let bar: InputBar;
  beforeEach(() => {
    bar = new InputBar({ prompt: '> ', placeholder: 'Type here...' });
  });

  test('render inclui separador na primeira linha', () => {
    const lines = bar.render(20, 3);
    expect(lines.length).toBeGreaterThanOrEqual(2);
    // Primeira linha é o separador (─ repetido)
    const stripped = stripAnsi(lines[0]);
    expect(stripped).toMatch(/^─+$/);
  });

  test('separatorChar customizável', () => {
    const bar2 = new InputBar({ separatorChar: '=' });
    const lines = bar2.render(10, 3);
    const stripped = stripAnsi(lines[0]);
    expect(stripped).toMatch(/^=+$/);
  });

  test('separador tem width caracteres', () => {
    const lines = bar.render(30, 3);
    const stripped = stripAnsi(lines[0]);
    expect(stripped.length).toBe(30);
  });

  test('minHeight = TextInput.minHeight + 1', () => {
    expect(bar.minHeight()).toBe(2); // 1 linha input + 1 separador
  });

  test('getValue retorna string vazia inicialmente', () => {
    expect(bar.getValue()).toBe('');
  });

  test('clear limpa o conteúdo', () => {
    bar.onFocus();
    // Simular digitação via handleKey
    bar.handleKey({ key: 'h', ctrl: false, meta: false, shift: false, raw: 'h' });
    bar.handleKey({ key: 'i', ctrl: false, meta: false, shift: false, raw: 'i' });
    expect(bar.getValue()).toBe('hi');
    bar.clear();
    expect(bar.getValue()).toBe('');
  });

  test('onSubmit callback é chamado ao pressionar Enter', () => {
    let submitted = '';
    bar.onSubmit = (text) => { submitted = text; };
    bar.onFocus();
    bar.handleKey({ key: 'h', ctrl: false, meta: false, shift: false, raw: 'h' });
    bar.handleKey({ key: 'return', ctrl: false, meta: false, shift: false, raw: '\r' });
    expect(submitted).toBe('h');
  });

  test('onChange callback é chamado ao digitar', () => {
    const changes: string[] = [];
    bar.onChange = (text) => { changes.push(text); };
    bar.onFocus();
    bar.handleKey({ key: 'x', ctrl: false, meta: false, shift: false, raw: 'x' });
    expect(changes).toContain('x');
  });

  test('handleKey delega ao TextInput', () => {
    bar.onFocus();
    bar.handleKey({ key: 'a', ctrl: false, meta: false, shift: false, raw: 'a' });
    expect(bar.getValue()).toBe('a');
  });
});
```

### `src/chat/status-bar.test.ts`

```typescript
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

  test('render retorna linha com width aproximado', () => {
    bar = new StatusBar();
    bar.setModel('gpt-4o');
    bar.setTokens(100, 50);
    const line = bar.render(60, 1)[0];
    // Linha stripped deve ser <= 60 visualmente (pode ter ANSI codes)
    const stripped = stripAnsi(line);
    // Não checar length exata por causa de espaçamento, apenas que tem conteúdo
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
```

### `src/chat/chat-layout.test.ts`

```typescript
import { describe, test, expect, afterEach } from 'bun:test';
import { ChatLayout } from './chat-layout';
import { stripAnsi } from '../utils/strip-ansi';

describe('ChatLayout', () => {
  let layout: ChatLayout;
  afterEach(() => { layout?.statusBar.dispose(); });

  test('expõe messageList, inputBar, statusBar como propriedades', () => {
    layout = new ChatLayout();
    expect(layout.messageList).toBeDefined();
    expect(layout.inputBar).toBeDefined();
    expect(layout.statusBar).toBeDefined();
  });

  test('render retorna exatamente height linhas', () => {
    layout = new ChatLayout();
    const lines = layout.render(80, 20);
    expect(lines).toHaveLength(20);
  });

  test('render retorna height linhas com conteúdo', () => {
    layout = new ChatLayout();
    layout.messageList.addMessage({
      id: '1', role: 'user', content: 'Hello', timestamp: new Date(),
    });
    const lines = layout.render(80, 15);
    expect(lines).toHaveLength(15);
  });

  test('handleKey delega ao inputBar', () => {
    layout = new ChatLayout();
    layout.inputBar.onFocus();
    layout.handleKey({ key: 'z', ctrl: false, meta: false, shift: false, raw: 'z' });
    expect(layout.inputBar.getValue()).toBe('z');
  });

  test('statusBar ocupa exatamente 1 linha na parte inferior', () => {
    layout = new ChatLayout();
    layout.statusBar.setModel('test-model');
    const lines = layout.render(80, 10);
    // Última linha deve conter o modelo
    const lastLine = stripAnsi(lines[lines.length - 1]);
    expect(lastLine).toContain('test-model');
  });

  test('minHeight é razoável (> 4)', () => {
    layout = new ChatLayout();
    expect(layout.minHeight()).toBeGreaterThan(4);
  });
});
```

---

## 8. Verificação pós-implementação

Executar em ordem:

```bash
# 1. Typecheck — 0 erros
bun run typecheck

# 2. Lint — 0 warnings
bun run lint

# 3. Testes — todos passando (esperado: ~81+ testes)
bun test
```

**Checklist de verificação:**
- [ ] `bun run typecheck` → 0 erros
- [ ] `bun run lint` → 0 warnings
- [ ] `bun test` → todos os testes passam (61 existentes + ~20 novos)
- [ ] `MessageList` rende mensagens user em verde, assistant em cyan
- [ ] `InputBar` tem separador `─` na primeira linha
- [ ] `StatusBar` sempre retorna exatamente 1 linha
- [ ] `ChatLayout.render(80, 20)` retorna exatamente 20 linhas
- [ ] `src/chat/index.ts` exporta `ChatMessage` e `MessageRole`
- [ ] `src/chat/tool-call.ts`, `markdown.ts`, `code-block.ts`, `thinking-block.ts` ainda são placeholders (NÃO modificar)

---

## Armadilhas conhecidas

1. **`Spinner` constructor é positional**: `new Spinner(label, onUpdate)` — NÃO `new Spinner({ onUpdate })`.

2. **`Spinner.render()` retorna `[]` quando inativo** — `StatusBar` não usa `Spinner.render()` diretamente; usa `BRAILLE_FRAMES[frameIndex]` e gerencia seu próprio timer.

3. **`InputBar.render(width, height)` com `height < 2`**: garantir `Math.max(1, height - 1)` para o TextInput interno.

4. **`MessageList.scrollOffset` não pode ficar negativo** — clampar em 0.

5. **`ChatLayout.render` deve retornar EXATAMENTE `height` linhas** — se `messagesHeight = 0`, `MessageList.render(width, 0)` deve retornar `[]` (verificar que MessageList aceita height=0 sem erro).

6. **Testes de `StatusBar` e `ChatLayout`**: usar `afterEach(() => bar?.dispose())` para limpar timers e evitar que testes pendurem.
