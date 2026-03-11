export class RenderScheduler {
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastRenderTime = 0;
  private disposed = false;
  private readonly targetInterval: number;

  /**
   * @param onRender  Callback chamado a cada frame — deve chamar Renderer.render()
   * @param targetFps Frame rate alvo. Default: 30fps (33ms/frame)
   */
  constructor(
    private readonly onRender: () => void,
    targetFps: number = 30
  ) {
    this.targetInterval = Math.floor(1000 / targetFps);
  }

  /**
   * Marca o estado como dirty e agenda um render se não houver um pendente.
   * Chamadas múltiplas antes do próximo frame são coalescidas em um único render.
   */
  scheduleRender(): void {
    if (this.disposed) return;
    this.dirty = true;
    if (this.timer !== null) return;

    const elapsed = Date.now() - this.lastRenderTime;
    const delay = Math.max(0, this.targetInterval - elapsed);

    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.dirty && !this.disposed) {
        this.dirty = false;
        this.lastRenderTime = Date.now();
        this.onRender();
      }
    }, delay);
  }

  /**
   * Força render imediato independente do timer.
   * Usar apenas para o primeiro render ou após resize.
   */
  renderNow(): void {
    if (this.disposed) return;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.dirty = false;
    this.lastRenderTime = Date.now();
    this.onRender();
  }

  /**
   * Cancela timer pendente e marca como disposed.
   * Chamar obrigatoriamente no shutdown da aplicação.
   */
  dispose(): void {
    this.disposed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Retorna true se há um render pendente (útil para testes). */
  get isPending(): boolean {
    return this.timer !== null;
  }

  /** Retorna true se o scheduler foi disposed. */
  get isDisposed(): boolean {
    return this.disposed;
  }
}
