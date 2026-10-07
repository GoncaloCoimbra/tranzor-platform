import { create } from 'zustand';

export interface ChatMessage {
  id: string;
  tempId?: string;
  channelId: string;
  text: string;
  userId: string;
  ts: number;
  pending?: boolean;
  system?: boolean;
  fileUrl?: string;
  kind?: string;
  payload?: any;
  readBy?: Array<{ userId: string; readAt: string }>;
}

interface ChatState {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  prependMessages: (messages: ChatMessage[]) => void;
  clearChannel: (channelId: string) => void;
  removeMessage: (messageId: string) => void;
  addReadReceipt: (messageId: string, receipt: { userId: string; readAt: string }) => void;
  confirmMessage: (tempId: string, nextMessage: ChatMessage) => void;
  failMessage: (tempId: string) => void;
  failPendingMessages: () => number;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (message) => set((state) => state.messages.some((current) => current.id === message.id)
    ? state
    : ({ messages: [...state.messages, message] })),
  prependMessages: (messages) => set((state) => ({ messages: [...messages, ...state.messages] })),
  clearChannel: (channelId) => set((state) => ({ messages: state.messages.filter((message) => message.channelId !== channelId) })),
  removeMessage: (messageId) => set((state) => ({
    messages: state.messages.filter((message) => message.id !== messageId),
  })),
  addReadReceipt: (messageId, receipt) => set((state) => ({
    messages: state.messages.map((message) => message.id !== messageId
      ? message
      : {
        ...message,
        readBy: [...(message.readBy || []).filter((current) => current.userId !== receipt.userId), receipt],
      }),
  })),
  confirmMessage: (tempId, nextMessage) => set((state) => {
    const pendingIndex = state.messages.findIndex((message) => message.tempId === tempId);
    if (pendingIndex >= 0) {
      return {
        messages: state.messages.map((message, index) =>
          index === pendingIndex ? { ...nextMessage, pending: false } : message
        ),
      };
    }
    if (state.messages.some((message) => message.id === nextMessage.id)) return state;
    return { messages: [...state.messages, { ...nextMessage, pending: false }] };
  }),
  failMessage: (tempId) => set((state) => ({
    messages: state.messages.filter((message) => message.tempId !== tempId || !message.pending)
  })),
  failPendingMessages: () => {
    let failedCount = 0;
    set((state) => {
      const messages = state.messages.filter((message) => {
        if (!message.pending) return true;
        failedCount += 1;
        return false;
      });
      return { messages };
    });
    return failedCount;
  },
}));
