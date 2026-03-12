import type { Component } from '../core/component';
import { padEndAnsi } from '../utils/width';

export type StackDirection = 'vertical' | 'horizontal';

export class Stack implements Component {
  private readonly components: Component[];
  private readonly direction: StackDirection;

  constructor(components: Component[], direction: StackDirection = 'vertical') {
    this.components = components;
    this.direction = direction;
  }

  addComponent(component: Component): void {
    this.components.push(component);
  }

  removeComponent(component: Component): void {
    const idx = this.components.indexOf(component);
    if (idx >= 0) this.components.splice(idx, 1);
  }

  render(width: number, height: number): string[] {
    if (this.direction === 'vertical') {
      return this.renderVertical(width, height);
    }
    return this.renderHorizontal(width, height);
  }

  private renderVertical(width: number, height: number): string[] {
    const heightPerComponent = Math.max(1, Math.floor(height / Math.max(1, this.components.length)));
    return this.components.flatMap(c => c.render(width, heightPerComponent));
  }

  private renderHorizontal(width: number, height: number): string[] {
    if (this.components.length === 0) return [];
    const colWidth = Math.max(1, Math.floor(width / this.components.length));
    const rendered = this.components.map(c => c.render(colWidth, height));
    const maxLines = Math.max(...rendered.map(r => r.length));
    const result: string[] = [];
    for (let i = 0; i < maxLines; i++) {
      const row = rendered.map((lines, ci) => {
        const line = lines[i] ?? '';
        const w = ci === this.components.length - 1
          ? width - colWidth * (this.components.length - 1)
          : colWidth;
        return padEndAnsi(line, w);
      });
      result.push(row.join(''));
    }
    return result;
  }
}
