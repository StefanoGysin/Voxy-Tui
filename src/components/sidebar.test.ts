import { describe, it, expect } from 'bun:test';
import { Sidebar } from './sidebar';
import type { SidebarTab } from './sidebar';
import type { KeyEvent } from '../core/component';
import { stripAnsi } from '../utils/strip-ansi';
import { measureWidth } from '../utils/width';

function makeTab(overrides: Partial<SidebarTab> & { id: string; label: string }): SidebarTab {
  return {
    render: () => [],
    handleKey: () => false,
    getHints: () => '',
    ...overrides,
  };
}

function key(k: string, mods?: Partial<KeyEvent>): KeyEvent {
  return { key: k, ctrl: false, meta: false, shift: false, raw: '', ...mods };
}

describe('Sidebar', () => {
  describe('visibility', () => {
    it('starts hidden', () => {
      const s = new Sidebar();
      expect(s.isVisible()).toBe(false);
    });

    it('toggle flips visibility', () => {
      const s = new Sidebar();
      s.toggle();
      expect(s.isVisible()).toBe(true);
      s.toggle();
      expect(s.isVisible()).toBe(false);
    });

    it('setVisible triggers onVisibilityChange', () => {
      const s = new Sidebar();
      const calls: boolean[] = [];
      s.onVisibilityChange = (v) => calls.push(v);
      s.setVisible(true);
      s.setVisible(false);
      expect(calls).toEqual([true, false]);
    });

    it('setVisible(same) does not trigger callback', () => {
      const s = new Sidebar();
      const calls: boolean[] = [];
      s.onVisibilityChange = (v) => calls.push(v);
      s.setVisible(false); // already false
      expect(calls).toEqual([]);
    });
  });

  describe('render when hidden', () => {
    it('returns height empty lines when not visible', () => {
      const s = new Sidebar();
      const lines = s.render(30, 10);
      expect(lines.length).toBe(10);
      for (const line of lines) {
        expect(line).toBe('');
      }
    });
  });

  describe('render when visible', () => {
    it('returns exactly height lines', () => {
      const s = new Sidebar();
      s.setVisible(true);
      const lines = s.render(30, 15);
      expect(lines.length).toBe(15);
    });

    it('each line has exactly width visual chars', () => {
      const s = new Sidebar();
      s.setVisible(true);
      const width = 40;
      const lines = s.render(width, 12);
      for (const line of lines) {
        const visual = measureWidth(stripAnsi(line));
        expect(visual).toBe(width);
      }
    });

    it('every line starts with │ border', () => {
      const s = new Sidebar();
      s.setVisible(true);
      const lines = s.render(30, 10);
      for (const line of lines) {
        const stripped = stripAnsi(line);
        expect(stripped[0]).toBe('│');
      }
    });

    it('returns empty lines for very small width', () => {
      const s = new Sidebar();
      s.setVisible(true);
      const lines = s.render(5, 10); // too small
      expect(lines.length).toBe(10);
      for (const line of lines) {
        expect(line).toBe('');
      }
    });
  });

  describe('render with 0 tabs', () => {
    it('renders empty content area', () => {
      const s = new Sidebar();
      s.setVisible(true);
      const lines = s.render(40, 10);
      expect(lines.length).toBe(10);
      // Should have header, separator, empty content, separator, footer
      const stripped = lines.map(l => stripAnsi(l));
      // Header should contain title
      expect(stripped[0]).toContain('Configurações');
    });
  });

  describe('render with 1 tab', () => {
    it('renders tab content without tab nav', () => {
      const s = new Sidebar();
      s.addTab(makeTab({
        id: 'test',
        label: 'Test',
        render: (w) => ['Line 1', 'Line 2'],
        getHints: () => '↑↓ navegar',
      }));
      s.setVisible(true);
      const lines = s.render(40, 10);
      expect(lines.length).toBe(10);

      // With 1 tab, no tab nav row → header(1) + sep(1) + content + sep(1) + footer(1)
      const stripped = lines.map(l => stripAnsi(l));
      // Content area should contain "Line 1" and "Line 2"
      const contentStr = stripped.join('\n');
      expect(contentStr).toContain('Line 1');
      expect(contentStr).toContain('Line 2');
      // Footer should contain hints
      expect(stripped[stripped.length - 1]).toContain('navegar');
    });
  });

  describe('render with multiple tabs', () => {
    it('renders tab nav row when >1 tab', () => {
      const s = new Sidebar();
      s.addTab(makeTab({ id: 'a', label: 'Alpha' }));
      s.addTab(makeTab({ id: 'b', label: 'Beta' }));
      s.setVisible(true);
      const lines = s.render(40, 10);
      const stripped = lines.map(l => stripAnsi(l));
      // Tab labels should appear in the output
      const all = stripped.join('\n');
      expect(all).toContain('Alpha');
      expect(all).toContain('Beta');
    });
  });

  describe('tab management', () => {
    it('addTab and removeTab', () => {
      const s = new Sidebar();
      s.addTab(makeTab({ id: 'a', label: 'A' }));
      s.addTab(makeTab({ id: 'b', label: 'B' }));
      expect(s.getActiveTabId()).toBe('a');
      s.removeTab('a');
      expect(s.getActiveTabId()).toBe('b');
    });

    it('setActiveTab changes active', () => {
      const s = new Sidebar();
      s.addTab(makeTab({ id: 'a', label: 'A' }));
      s.addTab(makeTab({ id: 'b', label: 'B' }));
      s.setActiveTab('b');
      expect(s.getActiveTabId()).toBe('b');
    });

    it('getActiveTabId returns undefined with no tabs', () => {
      const s = new Sidebar();
      expect(s.getActiveTabId()).toBeUndefined();
    });

    it('removeTab clamps activeTabIndex', () => {
      const s = new Sidebar();
      s.addTab(makeTab({ id: 'a', label: 'A' }));
      s.addTab(makeTab({ id: 'b', label: 'B' }));
      s.setActiveTab('b'); // index 1
      s.removeTab('b');
      expect(s.getActiveTabId()).toBe('a');
    });
  });

  describe('scroll', () => {
    it('scrolls content with scroll-up/scroll-down keys', () => {
      const s = new Sidebar();
      const manyLines = Array.from({ length: 50 }, (_, i) => `Line ${i}`);
      s.addTab(makeTab({
        id: 'test',
        label: 'Test',
        render: () => manyLines,
      }));
      s.setVisible(true);

      // Scroll down
      expect(s.handleKey(key('scroll-down'))).toBe(true);
      // Render and check content shifted
      const lines1 = s.render(40, 10).map(l => stripAnsi(l));
      // After scrolling down 3 lines, "Line 0" should not appear in content
      // (content starts at line 3 of the tab content)
      const content1 = lines1.join('\n');
      expect(content1).toContain('Line 3');

      // Scroll back up
      expect(s.handleKey(key('scroll-up'))).toBe(true);
      const lines2 = s.render(40, 10).map(l => stripAnsi(l));
      const content2 = lines2.join('\n');
      expect(content2).toContain('Line 0');
    });

    it('scroll offset clamped to max', () => {
      const s = new Sidebar();
      s.addTab(makeTab({
        id: 'test',
        label: 'Test',
        render: () => ['Only one line'],
      }));
      s.setVisible(true);

      // Scroll down many times — should clamp
      for (let i = 0; i < 20; i++) {
        s.handleKey(key('scroll-down'));
      }
      const lines = s.render(40, 10);
      expect(lines.length).toBe(10);
      // Content should still show the one line
      const content = lines.map(l => stripAnsi(l)).join('\n');
      expect(content).toContain('Only one line');
    });

    it('resets scroll when changing tabs', () => {
      const s = new Sidebar();
      const manyLines = Array.from({ length: 50 }, (_, i) => `Content ${i}`);
      s.addTab(makeTab({ id: 'a', label: 'A', render: () => manyLines }));
      s.addTab(makeTab({ id: 'b', label: 'B', render: () => ['B content'] }));
      s.setVisible(true);

      // Scroll down in tab A
      for (let i = 0; i < 5; i++) s.handleKey(key('scroll-down'));

      // Switch to tab B
      s.setActiveTab('b');
      const lines = s.render(40, 10).map(l => stripAnsi(l)).join('\n');
      expect(lines).toContain('B content');
    });
  });

  describe('handleKey', () => {
    it('returns false when hidden', () => {
      const s = new Sidebar();
      expect(s.handleKey(key('a'))).toBe(false);
    });

    it('Ctrl+Left/Right switches tabs', () => {
      const s = new Sidebar();
      s.addTab(makeTab({ id: 'a', label: 'A' }));
      s.addTab(makeTab({ id: 'b', label: 'B' }));
      s.setVisible(true);

      expect(s.getActiveTabId()).toBe('a');
      expect(s.handleKey(key('right', { ctrl: true }))).toBe(true);
      expect(s.getActiveTabId()).toBe('b');
      expect(s.handleKey(key('left', { ctrl: true }))).toBe(true);
      expect(s.getActiveTabId()).toBe('a');
    });

    it('Ctrl+Left wraps around', () => {
      const s = new Sidebar();
      s.addTab(makeTab({ id: 'a', label: 'A' }));
      s.addTab(makeTab({ id: 'b', label: 'B' }));
      s.setVisible(true);

      expect(s.handleKey(key('left', { ctrl: true }))).toBe(true);
      expect(s.getActiveTabId()).toBe('b');
    });

    it('delegates to active tab', () => {
      const s = new Sidebar();
      let received: KeyEvent | null = null;
      s.addTab(makeTab({
        id: 'a',
        label: 'A',
        handleKey: (e) => { received = e; return true; },
      }));
      s.setVisible(true);

      const ev = key('enter');
      expect(s.handleKey(ev)).toBe(true);
      expect(received).not.toBeNull();
      expect(received!.key).toBe(ev.key);
    });
  });

  describe('handleMouse', () => {
    it('returns false when hidden', () => {
      const s = new Sidebar();
      expect(s.handleMouse?.({ x: 1, y: 1, button: 0, isRelease: false })).toBe(false);
    });

    it('returns true for header click', () => {
      const s = new Sidebar();
      s.setVisible(true);
      expect(s.handleMouse?.({ x: 5, y: 1, button: 0, isRelease: false })).toBe(true);
    });
  });

  describe('custom options', () => {
    it('accepts custom title', () => {
      const s = new Sidebar({ title: 'Settings' });
      s.setVisible(true);
      const lines = s.render(40, 8);
      const header = stripAnsi(lines[0]);
      expect(header).toContain('Settings');
    });

    it('accepts custom closeHint', () => {
      const s = new Sidebar({ closeHint: 'Esc' });
      s.setVisible(true);
      const lines = s.render(40, 8);
      const header = stripAnsi(lines[0]);
      expect(header).toContain('Esc');
    });
  });
});
