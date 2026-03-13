/**
 * Core component interfaces for voxy-tui.
 * These are REAL interfaces — not placeholders.
 */

export interface KeyEvent {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  raw: string;
}

export interface MouseClickEvent {
  /** Coluna do clique (1-based, coordenada do terminal). */
  x: number;
  /** Linha do clique (1-based, coordenada do terminal). */
  y: number;
  /** Botão: 0=esquerdo, 1=meio, 2=direito. */
  button: number;
  /** true para release, false para press. */
  isRelease: boolean;
}

export interface Component {
  /** Render the component to an array of strings (one per line). */
  render(width: number, height: number): string[];

  /** Handle a key event. Return true if the event was consumed. */
  handleKey?(event: KeyEvent): boolean;

  /** Handle a mouse click event. Return true if the event was consumed. */
  handleMouse?(event: MouseClickEvent): boolean;

  /** Called when the component gains focus. */
  onFocus?(): void;

  /** Called when the component loses focus. */
  onBlur?(): void;

  /** Minimum height required by this component. */
  minHeight?(): number;

  /** Whether this component can receive focus. */
  focusable?: boolean;
}
