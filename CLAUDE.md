# voxy-tui — Architectural Decisions

## Project Overview
TypeScript TUI library for LLM CLI agents (Claude Code, Gemini CLI, voxy-cli).
Imperative paradigm: `new Component()`, `.render()`, `.update()` — NO React, NO Ink, NO Yoga.

## Runtime & Build
- **Dev runtime**: Bun (tests, scripts)
- **Build target**: Node.js 18+ (via tsup)
- **Module system**: Dual ESM + CJS (tsup `format: ['esm', 'cjs']`)
- **TypeScript**: strict mode, isolatedDeclarations enabled

## Module Resolution
- `module: "ESNext"` + `moduleResolution: "Bundler"` in tsconfig
- Reason: tsup uses esbuild as bundler; Bundler resolution doesn't require `.js` extensions in imports
- NO path aliases yet — will add `@core/*`, `@chat/*` in Session 2 with `tsup esbuildOptions.alias`

## Package Exports
Two entry points:
- `.` → `src/index.ts` (core, components, layout, utils)
- `./chat` → `src/chat/index.ts` (chat-specific components)

## Key Interfaces (src/core/component.ts)
- `KeyEvent`: key, ctrl, meta, shift, raw
- `Component`: render(w,h)→string[], handleKey?, onFocus?, onBlur?, minHeight?, focusable?

## Testing
- Bun test runner with preload: `src/test/setup.ts`
- `MockTerminal` class implements `Terminal` interface for testing

## Known TODOs
- ANSI toolkit (`src/core/ansi.ts`) não está no barrel público (`src/core/index.ts`) ainda — resolver na Sessão 4

## Session Plan (8 sessions)
1. **Session 1**: Project scaffolding (this session)
2. **Session 2**: ANSI engine + Terminal abstraction
3. **Session 3**: Diff renderer + RenderScheduler
4. **Session 4**: Core components (Text, Spinner, TextInput, Scrollable, Border)
5. **Session 5**: Layout system (Stack)
6. **Session 6**: Chat components (MessageList, InputBar, StatusBar, ToolCall)
7. **Session 7**: Markdown + CodeBlock rendering
8. **Session 8**: ChatLayout compositor + integration tests
