import type { Component, KeyEvent } from '../core/component';
import { MessageList } from './message-list';
import { InputBar } from './input-bar';
import { StatusBar } from './status-bar';

export class ChatLayout implements Component {
  readonly messageList: MessageList;
  readonly inputBar: InputBar;
  readonly statusBar: StatusBar;

  constructor() {
    this.messageList = new MessageList();
    this.inputBar = new InputBar({ placeholder: 'Type a message…' });
    this.statusBar = new StatusBar();
  }

  render(width: number, height: number): string[] {
    const statusHeight = 1;
    const inputHeight = Math.max(this.inputBar.minHeight(), 2);
    const messagesHeight = Math.max(0, height - statusHeight - inputHeight);

    const messageLines = this.messageList.render(width, messagesHeight);
    const inputLines = this.inputBar.render(width, inputHeight);
    const statusLines = this.statusBar.render(width, statusHeight);

    return [...messageLines, ...inputLines, ...statusLines];
  }

  handleKey(event: KeyEvent): boolean {
    return this.inputBar.handleKey(event);
  }

  minHeight(): number {
    return this.inputBar.minHeight() + this.statusBar.minHeight() + 3;
  }
}
