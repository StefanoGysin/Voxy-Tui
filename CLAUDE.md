# voxy-tui — Architectural Decisions

## Project Overview
TypeScript TUI library for LLM CLI agents (Claude Code, Gemini CLI, voxy-cli).
Imperative paradigm: `new Component()`, `.render()`, `.update()` — NO React, NO Ink, NO Yoga.

---

## Workflow — PromptForge Methodology

Este projeto usa uma metodologia chamada **PromptForge**:

1. **Stefano + Claude (conversa)** — planejam cada sessão juntos, analisam o trabalho anterior, identificam bugs, e forjam um prompt preciso.
2. **Claude Code (execução)** — recebe o prompt e executa a sessão de forma autônoma.
3. **Verificação rigorosa** — após execução, Claude (conversa) lê os arquivos reais (não apenas o resumo do Claude Code) e valida antes de aprovar o commit.

### Regras para Claude Code

- **Nunca criar arquivos fora de `src/`** a não ser que explicitamente pedido. Rascunhos, prompts, análises → pasta `.ai-work/` (está no `.gitignore`, nunca commitada).
- **Antes de cada commit**: `bun run typecheck` + `bun run lint` + `bun test` devem passar com 0 erros.
- **Commits**: seguir Conventional Commits em português (ver formato abaixo).
- **Branches**: cada sessão tem sua própria branch `feat/session-N-nome`, depois merge para `main`.
- **Merge**: sempre usar `--no-ff` (merge commit) ao mergear branches no `main`. Nunca fast-forward.
- **NÃO modificar** arquivos placeholder de sessões futuras (ex: `tool-call.ts`, `markdown.ts` são da Sessão 7 — não tocar na Sessão 6).

### Pasta `.ai-work/`

Área de trabalho compartilhada entre Stefano e Claude (conversa). Contém:
- `PROMPT_SESSION_N.md` — prompt forjado para cada sessão
- Rascunhos, análises, notas temporárias

**Nunca commitada.** Está no `.gitignore`.

### Formato de commit obrigatório

```
feat(escopo): descrição em português

- detalhe 1
- detalhe 2

🤖 Gerado com Voxy & claude-sonnet-4-6
```

---

## Runtime & Build

- **Dev runtime**: Bun (tests, scripts)
- **Build target**: Node.js 18+ (via tsup)
- **Module system**: Dual ESM + CJS (tsup `format: ['esm', 'cjs']`)
- **TypeScript**: strict mode, isolatedDeclarations enabled

## Module Resolution

- `module: "ESNext"` + `moduleResolution: "Bundler"` em tsconfig
- Motivo: tsup usa esbuild; resolução Bundler não exige extensões `.js` em imports
- Sem path aliases (ex: `@core/*`) — não suportado por esbuild sem config extra

## Package Exports

Dois entry points:
- `.` → `src/index.ts` (core, components, layout, utils)
- `./chat` → `src/chat/index.ts` (chat-specific components)

## Key Interfaces (`src/core/component.ts`)

```typescript
interface KeyEvent { key: string; ctrl: boolean; meta: boolean; shift: boolean; raw: string; }
interface Component {
  render(width: number, height: number): string[];
  handleKey?(event: KeyEvent): boolean;
  onFocus?(): void; onBlur?(): void;
  minHeight?(): number; focusable?: boolean;
}
```

## Testing

- Bun test runner com preload: `src/test/setup.ts`
- `MockTerminal` implementa interface `Terminal` para testes sem TTY real
- Fake timers: `jest.useFakeTimers()` requer Bun ≥ 1.3.10 (projeto usa 1.3.10+)
- Testes com `setInterval` (ex: StatusBar): sempre usar `afterEach(() => instance.dispose())` para evitar processo pendurado

---

## APIs críticas (armadilhas de implementação)

### Spinner
```typescript
// Construtor POSICIONAL — NÃO é options object:
new Spinner(label: string = '', onUpdate?: () => void)
spinner.start(label?: string): void
spinner.stop(): void
// render() retorna [] quando inativo
```

### TextInput
```typescript
// minHeight() === this.lines.length (não aceita height no render — ignora o parâmetro)
// render() sempre retorna exactly this.lines.length linhas
input.onSubmit?: (text: string) => void
input.onChange?: (text: string) => void
```

### MessageList / ChatLayout
```typescript
// render(width, height) retorna EXATAMENTE height linhas:
// — padding de linhas vazias no topo se conteúdo < height
// — slice se conteúdo > height (com scrollOffset)
// — textWidth = width - MARGIN_LEFT (sem scrollbar — buffer primário)
// ChatLayout distribui: messagesHeight + activityHeight + toastHeight + permHeight + statusHeight + inputHeight = height
// Ordem de render: messages → activity → toast → permission dialog → status → input
// setActivityLog(log: ToolActivityLog | null): void — slot entre messages e toast
// setToast(toast: Toast | null): void — slot entre activity e permission (0-3 linhas)
// setPermissionDialog(slot: PermissionDialogSlot | null): void — slot entre toast e status
// PermissionDialogSlot: { render(width): string[], handleKey(event): boolean, lineCount(): number, handleMouse?(event): boolean }
// Quando ativo (lineCount > 0), handleKey delega ao slot com prioridade sobre scroll e inputBar
// handleMouse roteia clicks na área do permission dialog para handleMouse do slot (com coordenadas localizadas)
// hasActivePermissionDialog(): boolean — retorna true se o slot está ativo (lineCount > 0)
// setSidebar(sidebar: Sidebar | null): void — sidebar à direita do chat (~30% width, min 28, max 40)
// toggleSidebarFocus(): void — alterna foco entre chat e sidebar
// isSidebarFocused(): boolean — retorna se sidebar tem foco
// handleMouse(event: MouseClickEvent): boolean — delega click para sidebar ou messageList
// handleDrag(event: MouseDragEvent): boolean — delega drag para sidebar
//
// Tool messages: collapsed por default em 1 linha (icon + name + summary + hint)
// Ctrl+E ou click: toggle expand/collapse de tool messages
// toggleLastTool(): boolean — togla expand/collapse da última tool message
// generateToolSummary: summary inteligente por tipo (Read, Glob, Grep, Bash, Edit, Write)
// toolRawInput: Record<string, unknown> — raw input preservado para summaries
// buildAllLines(): método interno que constrói todas as linhas com separadores corretos
// Separadores: box-drawing ─ (não ASCII -)
// Cores por tool: Read/Glob/Grep=selectedFg, Edit/Write=successFg, Bash=warningFg
```

### StreamingThinkingIndicator
```typescript
new StreamingThinkingIndicator()
indicator.start(): void          // inicia timer de 1s
indicator.stop(): void           // para timer, render() volta a []
indicator.dispose(): void        // alias de stop()
indicator.isActive(): boolean
indicator.getElapsedSeconds(): number
indicator.onUpdate?: () => void  // callback a cada 1s
// render() retorna [] quando inativo, 1 linha quando ativo
```

### ToolActivityLog
```typescript
new ToolActivityLog(options?: { maxVisible?: number })  // default maxVisible=10
log.addTool(id: string, name: string, label?: string): void
log.updateTool(id: string, status: ToolStatus, label?: string): void
log.clear(): void
log.dispose(): void
log.onUpdate?: () => void  // callback a cada FRAME_INTERVAL_MS enquanto há running
// render() retorna N linhas (até maxVisible), 1 por entry
```

### InputBar — histórico (Sessão 9)
```typescript
// ↑/↓ navegam histórico quando input é single-line (cursor em row 0)
bar.getHistory(): string[]              // cópia do histórico
bar.setHistory(entries: string[]): void // carrega histórico de sessão anterior
bar.clearHistory(): void
// Duplicatas consecutivas são ignoradas. Entradas vazias (trim) não são salvas.
```

### TUI
```typescript
// TUI não lida com stdin/raw mode — responsabilidade da camada de aplicação
new TUI(options?: TUIOptions)  // terminal?: Terminal, fps?: number
tui.start(): void   // inicia render loop + listener de resize
tui.stop(): void    // para tudo, idempotente
tui.scheduleRender(): void
tui.renderNow(): void
tui.layout: ChatLayout  // acesso direto ao layout
// start() faz ERASE_SCROLLBACK + ERASE_SCREEN + cursorTo(1,1) para garantir
// cursor em (1,1) known-good E scrollback limpo (evita scrollbar nativa do terminal).
// stop() emite ERASE_SCROLLBACK + ERASE_SCREEN + cursorTo(1,1) antes de restaurar terminal.
// Renderer.invalidate() emite ERASE_SCREEN + cursorTo(1,1) antes do re-render
// pós-resize, limpando a tela visível sem poluir o scrollback.
// Renderer.render() ancora cursor na última linha com cursorTo(length, 1)
// em ambos os paths (primeiro render e diff) — elimina cursor drift cumulativo.
```

### Renderer
```typescript
// Full redraw threshold: 15% das linhas mudaram → full redraw em vez de diff
// Este valor foi ajustado de 50% para 15% para garantir que mudanças de layout
// médias (ex: permission dialog aparecendo/desaparecendo ~27% das linhas)
// sejam renderizadas via full redraw com synchronized output (sem ghost text).
// NÃO aumentar este valor sem testar com permission dialog em terminal de 30 linhas.
```

### Scrollable
```typescript
new Scrollable(child: Component)
scrollable.scrollUp(lines?: number): void    // default: 1
scrollable.scrollDown(lines?: number): void  // default: 1
scrollable.scrollToTop(): void
scrollable.scrollToBottom(): void
scrollable.getScrollOffset(): number
// handleKey: 'pageup'/'pagedown' = scroll por (lastHeight - 1) linhas
// render() passa height=10000 para o filho — filho deve renderizar todo conteúdo
```

### ThinkingBlock
```typescript
new ThinkingBlock()
block.setContent(text: string): void
block.isCollapsed(): boolean
block.toggle(): void
// render(width, _height): usa width para wrap de conteúdo (linhas wrapped a Math.max(1, width-2))
// Toggle via click ocorre no PRESS (não no release) — evita falha com drag events espúrios do Windows Terminal
```

### Toast
```typescript
new Toast()
toast.show(options: ToastOptions): string     // retorna ID, adiciona à fila (máx 3 FIFO)
toast.dismiss(id?: string): void              // remove por ID ou o mais antigo
toast.clear(): void                           // remove todos, limpa timers
toast.dispose(): void                         // alias de clear()
toast.count(): number
toast.visibleLineCount(): number
toast.onUpdate?: () => void
// ToastType: 'info' | 'success' | 'warning' | 'error' | 'mode'
// Cada toast usa setTimeout individual (one-shot), default 3000ms. duration=0 = sem auto-dismiss.
// render() retorna [] quando vazio, 1 linha por toast quando ativo (máx 3)
```

### Theme (`src/core/theme.ts`)
```typescript
import { theme } from 'voxy-tui';
// Objeto readonly com cores ANSI pré-computadas:
// theme.panelBg       — bg(12, 16, 26)  — fundo de painéis (sidebar, permission dialog)
// theme.panelHeaderBg — bg(15, 20, 30)  — fundo de headers de painéis
// theme.borderFg      — fg(40, 55, 70)  — cor de bordas e separadores ─
// theme.selectedBg    — bg(20, 32, 45)  — fundo de item selecionado
// theme.selectedFg    — fg(34, 211, 238) — texto de item selecionado (cyan)
// theme.titleFg       — fg(147, 161, 182) — títulos
// theme.textDim       — fg(72, 85, 106) — texto secundário
// theme.hintsFg       — fg(58, 71, 89)  — hints e atalhos
// theme.dangerFg, theme.dangerSelectedBg, theme.dangerSelectedFg — modo danger
// theme.scrollbarThumbFg — fg(168, 168, 168) — cor do polegar do scrollbar
// theme.scrollbarThumbBg — bg(88, 88, 88)    — fundo do polegar
// theme.scrollbarTrackFg — fg(58, 58, 58)    — cor da trilha
// theme.scrollbarTrackBg — bg(28, 28, 28)    — fundo da trilha
// theme.scrollbarSepFg   — fg(48, 48, 48)    — separador entre conteúdo e scrollbar
// Anti-bleed pattern: padded.replaceAll(RESET, RESET + bg) — previne bleed de background quando ANSI RESET aparece mid-line
```

### `padEndAnsi` (novo utilitário)
```typescript
import { padEndAnsi } from 'voxy-tui';
// Pad ANSI-aware: mede largura visual, adiciona espaços até targetWidth
padEndAnsi(line: string, targetWidth: number): string
```

### `fitWidth` (utilitário de largura exata)
```typescript
import { fitWidth } from 'voxy-tui';
// Garante que a linha tenha EXATAMENTE targetWidth colunas visuais:
// — Se visual < target: pad com espaços (como padEndAnsi)
// — Se visual === target: retorna sem modificação
// — Se visual > target: trunca preservando sequências ANSI (sem cortar mid-char)
// Sanitiza tabs (\t → 2 espaços) antes de medir
fitWidth(line: string, targetWidth: number): string
```

---

## Limitações conhecidas

| Componente | Limitação | Status |
|---|---|---|
| `Border.render` | `padEnd()` sem ANSI awareness — padding errado com texto colorido | ✅ Resolvido (Session 10) |
| `Stack` (horizontal) | `padEnd()` sem ANSI awareness em colunas | ✅ Resolvido (Session 10) |
| `TextInput` | `cursorCol` em code-unit index (não visual) — cursor pode deslocar com emoji wide | Aceitável |
**Resolvidos**: `Text.alignLine` — usava `line.length`, agora usa `measureWidth(stripAnsi(line))` ✓

---

## Session Plan

| Sessão | Branch | Status | Testes |
|---|---|---|---|
| 1 — Scaffolding | `feat/session-1-*` | ✅ merged | — |
| 2 — ANSI + Terminal | `feat/session-2-core-io` | ✅ merged | 5 |
| 3 — Renderer + Scheduler | `feat/session-3-scheduler` | ✅ merged | 12 |
| 4 — Core Components | `feat/session-4-components` | ✅ merged | 43 |
| 5 — TextInput + Stack | `feat/session-5-input` | ✅ merged | 61 |
| 6 — Chat Kit básico | `feat/session-6-chat` | ✅ merged | 92 |
| **7 — Markdown + CodeBlock** | `feat/session-7-markdown` | ✅ merged | 128 |
| **8 — TUI Class + Demo** | `feat/session-8-demo` | ✅ merged | 134 |
| **9 — Componentes Avançados** | `feat/session-9-advanced` | ✅ merged | 168 |
| **10 — Bugfixes + Scrollable** | `feat/session-10-fixes` | ✅ merged | 190 |
| **30 — EAW Dashes Fix** | `feat/session-30-eaw-dashes` | ✅ merged | 190 |
| **31 — Buffer Primário** | `feat/session-31-buffer-primario` | ✅ merged | 333 |
| **32 — Remove Scrollbar** | `feat/session-32-remove-scrollbar` | ✅ merged | 320 |
| **33 — Ghost Text Fix** | `feat/session-33-ghost-text-fix` | ✅ merged | 323 |
| **34 — Ghost Text Fix II** | `fix/session-34-ghost-text-scroll` | ✅ merged | 321 |
| **35B — ThinkingBlock Fixes** | `feat/session-35b-thinking-block-fixes` | ✅ merged | 356 |
| **36 — Toast Notification** | `feat/session-36-toast` | ✅ merged | 32 |
| **37 — PermissionDialogSlot** | `feat/permission-dialog-slot` | ✅ merged | — |
| **38 — Tool Oneline** | `feat/tool-oneline` | 🔄 em progresso | 468 |

---

## Estrutura de arquivos atual

```
src/
├── core/
│   ├── component.ts     — KeyEvent, Component, MouseClickEvent, MouseDragEvent interfaces
│   ├── ansi.ts          — constantes e funções ANSI completas
│   ├── terminal.ts      — Terminal interface + ProcessTerminal
│   ├── renderer.ts      — diff line-level + synchronized output (threshold 15%)
│   ├── scheduler.ts     — RenderScheduler 30fps com dirty flag
│   ├── theme.ts         — Sistema de cores centralizado (panelBg, borderFg, selectedBg, etc.)
│   └── index.ts         — barrel público
├── components/
│   ├── text.ts          — Text com wrap/align/color
│   ├── spinner.ts       — Spinner braille com onUpdate callback
│   ├── text-input.ts    — MultilineEditor completo (undo, kill ring, Emacs)
│   ├── border.ts        — Border single/double/rounded
│   ├── scrollable.ts    — Scrollable wrapper (scroll vertical com pageup/pagedown)
│   ├── toast.ts         — Toast notification (tag compacta, auto-dismiss, FIFO)
│   ├── sidebar.ts       — Sidebar com tabs plugáveis, anti-bleed pattern, collapse/expand
│   ├── dialog.ts        — Dialog component
│   ├── dropdown.ts      — Dropdown component
│   └── index.ts
├── layout/
│   ├── stack.ts         — Stack vertical + horizontal
│   └── index.ts
├── chat/
│   ├── types.ts         — ChatMessage (toolRawInput, toolCollapsed), MessageRole
│   ├── message-list.ts  — lista scrollável com sticky bottom + tool oneline rendering
│   ├── input-bar.ts     — TextInput + separador ─ + histórico ↑/↓
│   ├── status-bar.ts    — spinner + model + tokens (1 linha)
│   ├── chat-layout.ts   — compositor MessageList+InputBar+StatusBar
│   ├── tool-call.ts     — display de tool use (nome, input, output, status)
│   ├── markdown.ts      — render Markdown com marked lexer
│   ├── code-block.ts    — syntax highlight com cli-highlight
│   ├── thinking-block.ts — bloco colapsável para chain-of-thought
│   ├── streaming-thinking-indicator.ts  — indicador "◆ Pensando... (Xs)"
│   ├── tool-activity-log.ts             — log compacto de tool calls
│   └── index.ts
├── utils/
│   ├── wrap.ts          — wrapText(text, width): string[]
│   ├── truncate.ts      — truncate com ellipsis
│   ├── strip-ansi.ts    — stripAnsi + ANSI_REGEX
│   ├── width.ts         — measureWidth (string-width wrapper)
│   ├── input-parser.ts  — parseKey RawKey→KeyEvent, bracketed paste
│   └── index.ts
├── tui.ts               — TUI class (compositor top-level)
├── test/
│   └── setup.ts         — MockTerminal
└── index.ts             — barrel público principal

examples/
└── demo.ts              — demo animado (bun run examples/demo.ts)
```
