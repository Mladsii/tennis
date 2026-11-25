import { api } from './client'

export interface SubUser {
  id: string; first_name: string; last_name: string; nickname: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string | null
  price: string
  hours_total: number
  validity_days: number
  is_active: boolean
  created_at: string
}

export interface UserSubscription {
  id: string
  plan: SubscriptionPlan
  user: SubUser
  sold_by: SubUser | null
  hours_remaining: string
  purchased_at: string
  expires_at: string
  status: string
  created_at: string
}

export const subscriptionsApi = {
  async listPlans(includeInactive = false): Promise<SubscriptionPlan[]> {
    const { data } = await api.get<SubscriptionPlan[]>('/subscriptions/plans', {
      params: { include_inactive: includeInactive },
    })
    return data
  },
  async createPlan(plan: {
    name: string; description?: string; price: number; hours_total: number; validity_days: number
  }): Promise<SubscriptionPlan> {
    const { data } = await api.post<SubscriptionPlan>('/subscriptions/plans', plan)
    return data
  },
  async updatePlan(id: string, update: Partial<{
    name: string; description: string; price: number; hours_total: number; validity_days: number; is_active: boolean
  }>): Promise<SubscriptionPlan> {
    const { data } = await api.put<SubscriptionPlan>(`/subscriptions/plans/${id}`, update)
    return data
  },
  async sell(planId: string, userId: string): Promise<UserSubscription> {
    const { data } = await api.post<UserSubscription>('/subscriptions/sell', {
      plan_id: planId, user_id: userId,
    })
    return data
  },
  async userSubscriptions(userId: string): Promise<UserSubscription[]> {
    const { data } = await api.get<UserSubscription[]>(`/subscriptions/user/${userId}`)
    return data
  },
}
