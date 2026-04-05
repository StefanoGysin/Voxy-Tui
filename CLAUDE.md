# CLAUDE.md

Orientações para agentes de automação voxy-tui. Regras obrigatórias, armadilhas e padrões do projeto.

**Regra #1**: Antes de cada commit — `bun run typecheck` + `bun run lint` + `bun test` + `bun run build` devem passar com 0 erros.
**Regra #2**: Commits seguem Conventional Commits em português (ver seção Git abaixo).
**Regra #3**: Após modificar voxy-tui, executar `bun run build` para que voxy-cli reflita as mudanças.

---

## Visão Geral

Biblioteca TUI em TypeScript para agentes CLI de LLM (Claude Code, Gemini CLI, voxy-cli).
Paradigma imperativo: `new Component()`, `.render()`, `.update()` — sem React, sem Ink, sem Yoga.

---

## Relação Cross-Project

- **voxy-cli** depende via link local: `"voxy-tui": "file:../voxy-tui"`
- Dois entry points: `'voxy-tui'` (core, components, layout, utils) e `'voxy-tui/chat'` (chat)
- Rebuild obrigatório após mudanças: voxy-cli usa `dist/` compilado, não source
- Principal consumidor: `TUIRepl.ts` no voxy-cli (branch `feature/tui-repl`, migrando de React/Ink)

---

## Git & Conventional Commits

**Formato obrigatório**:
```
<type>(<scope>): <descrição em português>

- detalhe 1
- detalhe 2

🤖 Gerado com Voxy & {MODEL_NAME}
```

**Exemplos válidos**:
```bash
feat(chat): Adiciona suporte a streaming de mensagens
fix(renderer): Corrige threshold de full redraw
refactor(core): Exporta modificadores ANSI no barrel público
```

**Branches**:
- `feat/*`, `fix/*`, `refactor/*` — merge para `main` com `--no-ff`

**Git Hooks**:
- `pre-commit`: Executa `lint` e `typecheck`

---

## Runtime & Build

- **Dev**: Bun (tests, scripts) | **Build**: tsup (dual ESM+CJS) | **Target**: Node.js 18+
- **TypeScript**: strict mode, isolatedDeclarations
- Sem path aliases (`@core/*` etc.) — esbuild não suporta sem config extra
- Dois entry points: `.` → `src/index.ts` (core) | `./chat` → `src/chat/index.ts` (chat)

---

## Armadilhas Críticas

- **Spinner**: construtor POSICIONAL — `new Spinner(label, onUpdate)`, NÃO é options object
- **TextInput**: `minHeight() === this.lines.length` — ignora `height` passado no `render()`
- **MessageList / ChatLayout**: `render(width, height)` retorna EXATAMENTE `height` linhas (padding no topo se conteúdo < height, slice se > height)
- **Renderer**: full redraw threshold = 15% das linhas mudaram. NÃO aumentar sem testar com permission dialog em terminal de 30 linhas
- **TUI.start()**: faz `ERASE_SCROLLBACK` — opera em buffer primário, não alternativo
- **Testes com setInterval** (ex: StatusBar): sempre usar `afterEach(() => instance.dispose())` para evitar processo pendurado

---

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

---

## Qualidade de Código

```bash
bun test           # Todos os testes devem passar
bun run typecheck  # 0 erros TypeScript
bun run lint       # 0 warnings ESLint
bun run build      # Build deve completar sem erros
```

---

## Regras para Agentes

- Criar arquivos apenas em `src/` — rascunhos, prompts, análises → pasta `.ai-work/`
- `.ai-work/` nunca commitada (está no `.gitignore`)
- Não modificar arquivos placeholder de sessões futuras

---

## Referências

- Projeto consumidor (voxy-cli): `workspace/voxy-cli/`
- Demo: `bun run examples/demo.ts`
