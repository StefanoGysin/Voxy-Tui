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

export interface Component {
  /** Render the component to an array of strings (one per line). */
  render(width: number, height: number): string[];

  /** Handle a key event. Return true if the event was consumed. */
  handleKey?(event: KeyEvent): boolean;

  /** Called when the component gains focus. */
  onFocus?(): void;

  /** Called when the component loses focus. */
  onBlur?(): void;

  /** Minimum height required by this component. */
  minHeight?(): number;

  /** Whether this component can receive focus. */
  focusable?: boolean;
}
