export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CourtTransfer {
  id: string;
  author_id: string;
  author: {
    id: string;
    first_name: string;
    last_name: string;
    nickname: string;
    stm_level?: string;
  };
  location_id: string;
  start_time: string;
  end_time: string;
  is_paid: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CourtTransferResponseItem {
  id: string;
  court_transfer_id: string;
  responder_id: string;
  responder: {
    id: string;
    first_name: string;
    last_name: string;
    nickname: string;
    stm_level?: string;
  };
  status: string;
  decline_reason: string | null;
  created_at: string;
}

export interface CourtTransferDetail extends CourtTransfer {
  responses: CourtTransferResponseItem[];
}

export interface PlayerRequest {
  id: string;
  requester_id: string;
  requester: {
    id: string;
    first_name: string;
    last_name: string;
    nickname: string;
    phone_primary?: string;
  };
  target_phone: string;
  target_user_id: string | null;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
}

export interface PreferredPlayer {
  id: string;
  user_id: string;
  player_id: string;
  player: {
    id: string;
    first_name: string;
    last_name: string;
    nickname: string;
    stm_level: string;
    photo_url: string | null;
  };
  is_active: boolean;
  created_at: string;
}
