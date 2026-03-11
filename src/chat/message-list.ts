import type { Component } from '../core/component';
import type { ChatMessage } from './types';
import { RESET, BOLD, DIM, ITALIC, FG_CYAN, FG_GREEN, FG_GRAY } from '../core/ansi';
import { wrapText } from '../utils/wrap';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderMessage(msg: ChatMessage, width: number): string[] {
  let header: string;
  const time = `${FG_GRAY}${DIM}${formatTime(msg.timestamp)}${RESET}`;

  switch (msg.role) {
    case 'user':
      header = `${FG_GREEN}${BOLD}● You${RESET} ${time}`;
      break;
    case 'assistant':
      header = `${FG_CYAN}${BOLD}◆ Assistant${RESET} ${time}`;
      break;
    case 'system':
      header = `${FG_GRAY}${ITALIC}◇ System${RESET} ${time}`;
      break;
  }

  const contentLines = wrapText(msg.content, width);
  return [header, ...contentLines, ''];
}

export class MessageList implements Component {
  private messages: ChatMessage[] = [];
  private scrollOffset = 0;
  private stickyBottom = true;

  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    if (this.stickyBottom) {
      this.scrollOffset = 0;
    }
  }

  updateLastMessage(content: string): void {
    if (this.messages.length === 0) return;
    this.messages[this.messages.length - 1].content = content;
    if (this.stickyBottom) {
      this.scrollOffset = 0;
    }
  }

  scrollUp(lines = 1): void {
    this.scrollOffset += lines;
    this.stickyBottom = false;
  }

  scrollDown(lines = 1): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - lines);
    if (this.scrollOffset === 0) {
      this.stickyBottom = true;
    }
  }

  scrollToBottom(): void {
    this.scrollOffset = 0;
    this.stickyBottom = true;
  }

  clear(): void {
    this.messages = [];
    this.scrollOffset = 0;
    this.stickyBottom = true;
  }

  render(width: number, height: number): string[] {
    if (height <= 0) return [];

    const allLines: string[] = [];
    for (const msg of this.messages) {
      allLines.push(...renderMessage(msg, width));
    }

    if (allLines.length <= height) {
      // Pad with empty lines at top
      const padding = height - allLines.length;
      return [...Array<string>(padding).fill(''), ...allLines];
    }

    // Clamp scrollOffset
    const maxOffset = Math.max(0, allLines.length - height);
    if (this.scrollOffset > maxOffset) {
      this.scrollOffset = maxOffset;
    }

    const end = allLines.length - this.scrollOffset;
    const start = end - height;
    return allLines.slice(start, end);
  }
}
