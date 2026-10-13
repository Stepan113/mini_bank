import { expireSession, getToken, isDemo } from './auth'
import type { Account, BankApi, EntriesPage, Transfer } from './types'

export class ApiError extends Error {
  status: number
  code?: string
  retryAfter?: number
  constructor(status: number, message: string, code?: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken()
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    throw new Error('Сервер не ответил. Проверьте соединение и попробуйте ещё раз.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) expireSession()
    const fallback: Record<number, string> = {
      400: 'Проверьте введённые данные.',
      401: 'Сессия завершилась. Войдите ещё раз.',
      403: 'Для доступа нужна роль mini-bank-user.',
      404: 'Данные не найдены.',
      409: 'Данные уже существуют или запрос конфликтует с предыдущим.',
      422: 'Проверьте сумму и получателя перевода.',
      429: 'Слишком много запросов. Попробуйте чуть позже.',
      503: 'Сервис временно недоступен. Попробуйте позже.',
    }
    const retryAfter = Number(response.headers.get('Retry-After'))
    throw new ApiError(
      response.status,
      body?.detail || fallback[response.status] || 'Не удалось выполнить запрос.',
      body?.code,
      retryAfter > 0 ? retryAfter : undefined,
    )
  }
  if (!body) throw new Error('Сервер вернул пустой или некорректный ответ.')
  return body as T
}

const httpApi: BankApi = {
  async getAccount() {
    try {
      return await request<Account>('/api/accounts/me')
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }
  },
  createAccount: (recipientHandle) =>
    request<Account>('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ recipientHandle }),
    }),
  getEntries: (cursor) =>
    request<EntriesPage>(
      `/api/accounts/me/entries?${new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) })}`,
    ),
  findRecipient: (handle) =>
    request<{ recipientSub: string }>(`/api/recipients/${encodeURIComponent(handle)}`),
  createTransfer: (body, key) =>
    request<Transfer>('/api/transfers', {
      method: 'POST',
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(body),
    }),
  getTransfer: (id) => request<Transfer>(`/api/transfers/${encodeURIComponent(id)}`),
}

export const api: BankApi = isDemo ? (await import('./demo')).demoApi : httpApi

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.retryAfter)
    return `${error.message} Повторите через ${error.retryAfter} сек.`
  return error instanceof Error ? error.message : 'Произошла ошибка. Попробуйте ещё раз.'
}
