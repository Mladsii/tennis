import { api } from './client'

export interface CashUser {
  id: string; first_name: string; last_name: string; nickname: string
}

export interface CashSession {
  id: string
  opened_by: CashUser | null
  opened_at: string
  closed_at: string | null
  status: 'open' | 'closed'
  notes: string | null
  created_at: string
}

export interface CashTransaction {
  id: string
  session_id: string
  booking_id: string | null
  user: CashUser | null
  created_by: CashUser | null
  amount: string
  payment_type: 'cash' | 'card' | 'sbp' | 'subscription'
  description: string
  status: 'completed' | 'refunded'
  created_at: string
}

export interface CashReport {
  session: CashSession
  total_cash: string
  total_card: string
  total_sbp: string
  total_subscription: string
  total_all: string
  transaction_count: number
  transactions: CashTransaction[]
}

export interface TransactionCreate {
  booking_id?: string
  user_id?: string
  amount: number
  payment_type: 'cash' | 'card' | 'sbp' | 'subscription'
  description?: string
  subscription_id?: string
}

export const cashApi = {
  async currentSession(): Promise<CashSession | null> {
    const { data } = await api.get<CashSession | null>('/cash/sessions/current')
    return data
  },
  async listSessions(limit = 20): Promise<CashSession[]> {
    const { data } = await api.get<CashSession[]>('/cash/sessions', { params: { limit } })
    return data
  },
  async openSession(notes?: string): Promise<CashSession> {
    const { data } = await api.post<CashSession>('/cash/sessions/open', { notes })
    return data
  },
  async closeSession(sessionId: string): Promise<CashSession> {
    const { data } = await api.post<CashSession>(`/cash/sessions/${sessionId}/close`)
    return data
  },
  async listTransactions(sessionId: string): Promise<CashTransaction[]> {
    const { data } = await api.get<CashTransaction[]>(`/cash/sessions/${sessionId}/transactions`)
    return data
  },
  async createTransaction(tx: TransactionCreate): Promise<CashTransaction> {
    const { data } = await api.post<CashTransaction>('/cash/transactions', tx)
    return data
  },
  async refundTransaction(txId: string): Promise<CashTransaction> {
    const { data } = await api.post<CashTransaction>(`/cash/transactions/${txId}/refund`)
    return data
  },
  async getReport(sessionId: string): Promise<CashReport> {
    const { data } = await api.get<CashReport>(`/cash/sessions/${sessionId}/report`)
    return data
  },
}
