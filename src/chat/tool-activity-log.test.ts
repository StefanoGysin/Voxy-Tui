import { describe, it, expect, afterEach, beforeEach, jest } from 'bun:test';
import { ToolActivityLog } from './tool-activity-log';
import { FRAME_INTERVAL_MS } from '../components/spinner';

const MAX_ENTRY_AGE_MS = 30_000;

describe('ToolActivityLog', () => {
  let log: ToolActivityLog;

  beforeEach(() => {
    jest.useFakeTimers();
    log = new ToolActivityLog();
  });

  afterEach(() => {
    log.dispose();
    jest.useRealTimers();
  });

  it('render() retorna [] sem entradas', () => {
    expect(log.render(80, 24)).toEqual([]);
  });

  it('addTool() adiciona entry running', () => {
    log.addTool('1', 'read_file', 'src/index.ts');
    expect(log.render(80, 24)).toHaveLength(1);
  });

  it('render() inclui nome da tool', () => {
    log.addTool('1', 'bash', 'bun test');
    const line = log.render(80, 24)[0];
    expect(line).toContain('bash');
  });

  it('render() inclui label', () => {
    log.addTool('1', 'read_file', 'src/index.ts');
    const line = log.render(80, 24)[0];
    expect(line).toContain('src/index.ts');
  });

  it('updateTool() remove entry imediatamente', () => {
    log.addTool('1', 'read_file');
    log.updateTool('1', 'done');
    expect(log.render(80, 24)).toHaveLength(0);
  });

  it('updateTool() error remove entry imediatamente', () => {
    log.addTool('1', 'bash');
    log.updateTool('1', 'error');
    expect(log.render(80, 24)).toHaveLength(0);
  });

  it('updateTool() para o timer quando todas removidas', () => {
    const cb = jest.fn();
    log.onUpdate = cb;
    log.addTool('1', 'read_file');
    log.updateTool('1', 'done');
    // onUpdate chamado 1x pela remoção, mas timer deve parar
    cb.mockClear();
    jest.advanceTimersByTime(FRAME_INTERVAL_MS * 5);
    expect(cb).not.toHaveBeenCalled();
  });

  it('timer continua se há outra entry running', () => {
    const cb = jest.fn();
    log.onUpdate = cb;
    log.addTool('1', 'read_file');
    log.addTool('2', 'bash');
    log.updateTool('1', 'done');
    jest.advanceTimersByTime(FRAME_INTERVAL_MS);
    expect(cb).toHaveBeenCalled();
  });

  it('maxVisible trunca entradas mais antigas', () => {
    log = new ToolActivityLog({ maxVisible: 2 });
    log.addTool('1', 'read_file');
    log.addTool('2', 'bash');
    log.addTool('3', 'edit');
    expect(log.render(80, 24)).toHaveLength(2);
    const lines = log.render(80, 24);
    expect(lines[0]).toContain('bash');
    expect(lines[1]).toContain('edit');
  });

  it('clear() remove todas entradas', () => {
    log.addTool('1', 'read_file');
    log.clear();
    expect(log.render(80, 24)).toEqual([]);
  });

  it('updateTool() com ID inexistente é no-op', () => {
    log.addTool('1', 'read_file');
    log.updateTool('999', 'done');
    expect(log.render(80, 24)).toHaveLength(1);
  });

  describe('deduplicação por ID', () => {
    it('addTool com ID duplicado não cria entry nova', () => {
      log.addTool('1', 'read_file', 'src/old.ts');
      log.addTool('1', 'bash', 'bun test');
      expect(log.render(80, 24)).toHaveLength(1);
      const line = log.render(80, 24)[0];
      expect(line).toContain('bash');
      expect(line).toContain('bun test');
    });

    it('addTool com ID duplicado reseta status para running', () => {
      log.addTool('1', 'read_file');
      // updateTool removes, then addTool re-adds
      log.updateTool('1', 'done');
      expect(log.render(80, 24)).toHaveLength(0);
      log.addTool('1', 'read_file', 'retry');
      expect(log.render(80, 24)).toHaveLength(1);
    });
  });

  describe('remoção imediata após done/error', () => {
    it('updateTool(done) remove entry imediatamente', () => {
      log.addTool('1', 'read_file');
      log.updateTool('1', 'done');
      expect(log.render(80, 24)).toHaveLength(0);
    });

    it('updateTool(error) remove entry imediatamente', () => {
      log.addTool('1', 'bash');
      log.updateTool('1', 'error');
      expect(log.render(80, 24)).toHaveLength(0);
    });

    it('onUpdate é chamado após remoção', () => {
      const cb = jest.fn();
      log.onUpdate = cb;
      log.addTool('1', 'read_file');
      cb.mockClear();
      log.updateTool('1', 'done');
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('visibleLineCount() retorna 0 após todas entries removidas', () => {
      log.addTool('1', 'read_file');
      log.addTool('2', 'bash');
      log.updateTool('1', 'done');
      log.updateTool('2', 'done');
      expect(log.visibleLineCount()).toBe(0);
    });

    it('entry running não é removida', () => {
      log.addTool('1', 'read_file');
      log.addTool('2', 'bash');
      log.updateTool('1', 'done');
      expect(log.render(80, 24)).toHaveLength(1);
      expect(log.render(80, 24)[0]).toContain('bash');
    });
  });

  describe('safety net: MAX_ENTRY_AGE_MS', () => {
    it('remove entries fantasma após 30s no render()', () => {
      log.addTool('1', 'read_file');
      jest.advanceTimersByTime(MAX_ENTRY_AGE_MS + 1);
      expect(log.render(80, 24)).toHaveLength(0);
    });

    it('mantém entries recentes', () => {
      log.addTool('1', 'read_file');
      jest.advanceTimersByTime(MAX_ENTRY_AGE_MS - 1000);
      expect(log.render(80, 24)).toHaveLength(1);
    });

    it('para timer quando todas entries expiram', () => {
      const cb = jest.fn();
      log.onUpdate = cb;
      log.addTool('1', 'bash');
      jest.advanceTimersByTime(MAX_ENTRY_AGE_MS + 1);
      cb.mockClear();
      log.render(80, 24); // triggers cleanup
      jest.advanceTimersByTime(FRAME_INTERVAL_MS * 5);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  it('onUpdate() é chamado a cada frame enquanto há running', () => {
    const cb = jest.fn();
    log.onUpdate = cb;
    log.addTool('1', 'bash');
    jest.advanceTimersByTime(FRAME_INTERVAL_MS * 3);
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('dispose() para timer', () => {
    const cb = jest.fn();
    log.onUpdate = cb;
    log.addTool('1', 'bash');
    log.dispose();
    jest.advanceTimersByTime(FRAME_INTERVAL_MS * 5);
    expect(cb).not.toHaveBeenCalled();
  });

  describe('visibleLineCount()', () => {
    it('retorna 0 sem entradas', () => {
      expect(log.visibleLineCount()).toBe(0);
    });

    it('retorna número de entradas quando abaixo do maxVisible', () => {
      log.addTool('1', 'bash');
      log.addTool('2', 'read_file');
      expect(log.visibleLineCount()).toBe(2);
    });

    it('retorna maxVisible quando entries excede maxVisible', () => {
      const smallLog = new ToolActivityLog({ maxVisible: 2 });
      smallLog.addTool('1', 'a');
      smallLog.addTool('2', 'b');
      smallLog.addTool('3', 'c');
      expect(smallLog.visibleLineCount()).toBe(2);
      smallLog.dispose();
    });

    it('retorna 0 após clear()', () => {
      log.addTool('1', 'bash');
      log.clear();
      expect(log.visibleLineCount()).toBe(0);
    });

    it('coincide com render().length', () => {
      log.addTool('1', 'bash');
      log.addTool('2', 'read_file');
      expect(log.visibleLineCount()).toBe(log.render(80, 24).length);
    });
  });
});
