export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  // Campo presente quando role === 'assistant' e há chain-of-thought
  thinkingContent?: string;
  // Campos presentes apenas quando role === 'tool'
  toolName?: string;
  toolInput?: string;
  toolOutput?: string[];
  toolStatus?: 'done' | 'error';
  toolCollapsed?: boolean;
  toolRawInput?: Record<string, unknown>;
}
