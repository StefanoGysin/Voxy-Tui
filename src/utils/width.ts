import stringWidth from 'string-width';
import { stripAnsi } from './strip-ansi';

export { stringWidth };

export function measureWidth(text: string): number {
  return stringWidth(text);
}

/**
 * Pad a string (que pode conter ANSI codes) até targetWidth colunas visuais.
 * Usa measureWidth(stripAnsi(line)) para medir a largura real.
 */
export function padEndAnsi(line: string, targetWidth: number): string {
  const visual = measureWidth(stripAnsi(line));
  const padding = Math.max(0, targetWidth - visual);
  return line + ' '.repeat(padding);
}

/**
 * Retorna o índice (JS string index, 0-based) em `line` correspondendo à coluna
 * visual `col` (0-based).
 *
 * Sequências ANSI têm largura visual zero e são puladas.
 * Caracteres wide (CJK, emoji) são tratados corretamente via measureWidth.
 * Surrogate pairs são tratados corretamente via codePointAt.
 *
 * Se `col` exceder a largura visual total da linha, retorna `line.length`.
 */
/**
 * Garante que a linha tenha EXATAMENTE targetWidth de largura visual.
 * - Se mais curta: pad com espaços
 * - Se mais larga: trunca (corte silencioso, preserva ANSI)
 *
 * CRÍTICO para concatenação horizontal: se uma linha exceder a largura,
 * o terminal faz line-wrap e toda a UI abaixo desalinha.
 */
export function fitWidth(line: string, targetWidth: number): string {
  const visual = measureWidth(stripAnsi(line))

  if (visual === targetWidth) return line
  if (visual < targetWidth) {
    return line + ' '.repeat(targetWidth - visual)
  }

  // Truncar: percorrer caractere a caractere, preservando ANSI
  const ansiRe = /\x1b\[[0-9;]*[mGKHFJABCDsuhl?]|\x1b[78]/y
  let result = ''
  let width = 0
  let i = 0

  while (i < line.length && width < targetWidth) {
    // Verificar sequência ANSI na posição i
    ansiRe.lastIndex = i
    const m = ansiRe.exec(line)
    if (m !== null) {
      result += m[0]
      i += m[0].length
      continue
    }

    // Caractere imprimível — tratar surrogate pairs
    const cp = line.codePointAt(i)!
    const cpLen = cp > 0xFFFF ? 2 : 1
    const ch = String.fromCodePoint(cp)
    const w = measureWidth(ch)

    if (width + w > targetWidth) break
    result += ch
    width += w
    i += cpLen
  }

  // Capturar ANSI sequences restantes após o truncamento (ex: RESET)
  while (i < line.length) {
    ansiRe.lastIndex = i
    const m = ansiRe.exec(line)
    if (m !== null && m.index === i) {
      result += m[0]
      i += m[0].length
    } else {
      break
    }
  }

  // Pad restante se truncamento deixou espaço (chars de largura 2)
  if (width < targetWidth) {
    result += ' '.repeat(targetWidth - width)
  }

  return result
}

export function byteIndexAtVisualCol(line: string, col: number): number {
  // Regex sticky: testa apenas na posição lastIndex (sem varrer a string toda)
  const ansiRe = /\x1b\[[0-9;]*[mGKHFJABCDsuhl?]|\x1b[78]/y
  let i    = 0
  let vcol = 0

  while (i < line.length && vcol < col) {
    // Verificar se começa uma sequência ANSI na posição i
    ansiRe.lastIndex = i
    const m = ansiRe.exec(line)
    if (m !== null) {
      // Sequência ANSI: 0 colunas visuais → pular
      i += m[0].length
      continue
    }

    // Caractere imprimível — tratar surrogate pairs (emoji, etc.)
    const cp    = line.codePointAt(i)!
    const cpLen = cp > 0xFFFF ? 2 : 1          // surrogates ocupam 2 code units
    const w     = measureWidth(String.fromCodePoint(cp))

    if (vcol + w > col) break   // este char cruzaria a coluna alvo → parar antes dele

    vcol += w
    i    += cpLen
  }

  return i
}
