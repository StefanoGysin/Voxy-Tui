import { describe, expect, test } from 'bun:test';
import { RenderScheduler } from './scheduler';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('RenderScheduler', () => {
  test('scheduleRender dispara onRender após ~33ms', async () => {
    let renderCount = 0;
    const scheduler = new RenderScheduler(() => renderCount++);

    scheduler.scheduleRender();
    expect(renderCount).toBe(0);

    await delay(50);
    expect(renderCount).toBe(1);
    scheduler.dispose();
  });

  test('múltiplas chamadas a scheduleRender produzem um único render (coalescing)', async () => {
    let renderCount = 0;
    const scheduler = new RenderScheduler(() => renderCount++);

    scheduler.scheduleRender();
    scheduler.scheduleRender();
    scheduler.scheduleRender();
    scheduler.scheduleRender();

    await delay(50);
    expect(renderCount).toBe(1);
    scheduler.dispose();
  });

  test('dispose() cancela timer pendente e previne render', async () => {
    let renderCount = 0;
    const scheduler = new RenderScheduler(() => renderCount++);

    scheduler.scheduleRender();
    expect(scheduler.isPending).toBe(true);

    scheduler.dispose();
    expect(scheduler.isDisposed).toBe(true);
    expect(scheduler.isPending).toBe(false);

    await delay(50);
    expect(renderCount).toBe(0);
  });

  test('scheduleRender após dispose não agenda timer', async () => {
    let renderCount = 0;
    const scheduler = new RenderScheduler(() => renderCount++);

    scheduler.dispose();
    scheduler.scheduleRender();

    await delay(50);
    expect(renderCount).toBe(0);
    expect(scheduler.isPending).toBe(false);
  });

  test('renderNow() dispara render imediatamente', () => {
    let renderCount = 0;
    const scheduler = new RenderScheduler(() => renderCount++);

    scheduler.renderNow();
    expect(renderCount).toBe(1);
    scheduler.dispose();
  });

  test('renderNow() cancela timer pendente de scheduleRender', async () => {
    let renderCount = 0;
    const scheduler = new RenderScheduler(() => renderCount++);

    scheduler.scheduleRender();
    expect(scheduler.isPending).toBe(true);

    scheduler.renderNow();
    expect(renderCount).toBe(1);
    expect(scheduler.isPending).toBe(false);

    await delay(50);
    expect(renderCount).toBe(1);
    scheduler.dispose();
  });

  test('scheduler com targetFps customizado respeita o intervalo', async () => {
    let renderCount = 0;
    const scheduler = new RenderScheduler(() => renderCount++, 10); // 10fps = 100ms

    // Primeiro render — lastRenderTime é 0 então dispara rápido
    scheduler.scheduleRender();
    await delay(20);
    expect(renderCount).toBe(1);

    // Segundo render — agora deve esperar ~100ms desde o último render
    scheduler.scheduleRender();
    await delay(50);
    expect(renderCount).toBe(1); // Ainda não (100ms interval)

    await delay(70); // Total: ~120ms desde scheduleRender
    expect(renderCount).toBe(2);
    scheduler.dispose();
  });
});
