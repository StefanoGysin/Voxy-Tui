import { TUI } from '../src/tui';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function streamText(tui: TUI, text: string, delayMs = 18): Promise<void> {
  let current = '';
  for (const char of text) {
    current += char;
    tui.layout.messageList.updateLastMessage(current);
    tui.scheduleRender();
    await sleep(delayMs);
  }
}

async function main(): Promise<void> {
  const tui = new TUI();

  tui.layout.statusBar.setModel('claude-sonnet-4-6');
  tui.layout.statusBar.setStatus('Aguardando…');

  tui.start();

  await sleep(300);

  // Mensagem do usuário
  tui.layout.messageList.addMessage({
    id: 'u1', role: 'user',
    content: 'Explique merge sort em TypeScript com código',
    timestamp: new Date()
  });
  tui.scheduleRender();

  await sleep(300);

  // Status: pensando
  tui.layout.statusBar.setMode('thinking');
  tui.layout.statusBar.setStatus('Pensando…');
  tui.scheduleRender();

  await sleep(500);

  // Mensagem do assistente começa vazia
  tui.layout.messageList.addMessage({
    id: 'a1', role: 'assistant', content: '', timestamp: new Date()
  });
  tui.scheduleRender();

  await sleep(200);

  // Status: respondendo
  tui.layout.statusBar.setMode('streaming');
  tui.layout.statusBar.setStatus('Respondendo…');
  tui.scheduleRender();

  // Stream do texto markdown
  const mdText = 'O **merge sort** é um algoritmo de ordenação recursivo com complexidade *O(n log n)*.\n\nFunciona dividindo o array ao meio, ordenando cada metade recursivamente e depois **mesclando** os resultados.\n\n';
  await streamText(tui, mdText);

  // Adicionar código TypeScript
  const codeText = mdText + '```typescript\nfunction mergeSort(arr: number[]): number[] {\n  if (arr.length <= 1) return arr;\n  const mid = Math.floor(arr.length / 2);\n  const left = mergeSort(arr.slice(0, mid));\n  const right = mergeSort(arr.slice(mid));\n  return merge(left, right);\n}\n\nfunction merge(a: number[], b: number[]): number[] {\n  const result: number[] = [];\n  let i = 0, j = 0;\n  while (i < a.length && j < b.length) {\n    result.push(a[i] <= b[j] ? a[i++] : b[j++]);\n  }\n  return [...result, ...a.slice(i), ...b.slice(j)];\n}\n```\n';
  tui.layout.messageList.updateLastMessage(codeText);
  tui.scheduleRender();

  await sleep(400);

  // Simular tool call via texto
  const withTool = codeText + '\n_Buscando arquivo relevante..._\n';
  tui.layout.messageList.updateLastMessage(withTool);
  tui.scheduleRender();

  await sleep(600);

  // Tool call concluída
  tui.layout.messageList.updateLastMessage(codeText + '\nArquivo lido com sucesso ✓\n');
  tui.layout.statusBar.setMode('idle');
  tui.layout.statusBar.setStatus('Concluído');
  tui.layout.statusBar.setContextUsage(1247, 200000);
  tui.scheduleRender();

  await sleep(500);

  // Segunda mensagem do usuário
  tui.layout.messageList.addMessage({
    id: 'u2', role: 'user', content: 'Obrigado!', timestamp: new Date()
  });
  tui.scheduleRender();

  await sleep(600);

  tui.layout.messageList.addMessage({
    id: 'a2', role: 'assistant', content: 'De nada! Boa sorte com seu projeto. 🎉', timestamp: new Date()
  });
  tui.scheduleRender();

  await sleep(700);

  tui.stop();
  process.exit(0);
}

main().catch(console.error);
