export interface ChatPeer {
  id: string;
  full_name: string;
  phone: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  peer: ChatPeer;
  last_message: Message | null;
  unread_count: number;
  last_message_at: string | null;
  created_at: string;
}

export type ChatWsEvent =
  | {
      type: 'message.created' | 'message.edited';
      conversation_id: string;
      message: Message;
    }
  | {
      type: 'message.deleted';
      conversation_id: string;
      message_id: string;
    }
  | {
      type: 'messages.read';
      conversation_id: string;
      by_user_id: string;
    };
