import type { Account, BankApi, Entry, Transfer, TransferRequest } from './types'

// Isolated in-memory demo. It never sends API requests and resets on reload.
let account: Account | null = null
const entries: Entry[] = []
const transfers = new Map<string, Transfer>()
const keys = new Map<string, { body: string; transferId: string }>()
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 250))

export const demoApi: BankApi = {
  async getAccount() {
    await delay()
    return account ? { ...account } : null
  },
  async createAccount(recipientHandle) {
    await delay()
    if (account) throw new Error('Счёт уже создан.')
    if (['bob_02', 'charlie_03'].includes(recipientHandle))
      throw new Error('Этот псевдоним уже занят.')
    account = {
      accountId: crypto.randomUUID(),
      recipientHandle,
      balanceKopecks: 100_000,
      currency: 'RUB',
    }
    return { ...account }
  },
  async getEntries(cursor) {
    await delay()
    const offset = Number(cursor || 0)
    return {
      items: entries.slice(offset, offset + 20),
      nextCursor: entries.length > offset + 20 ? String(offset + 20) : null,
    }
  },
  async findRecipient(handle) {
    await delay()
    if (handle === account?.recipientHandle) return { recipientSub: 'demo-alice' }
    if (!['bob_02', 'charlie_03'].includes(handle))
      throw new Error('Получатель не найден. В демо доступны bob_02 и charlie_03.')
    return { recipientSub: `demo-${handle}` }
  },
  async createTransfer(body: TransferRequest, key: string) {
    await delay()
    const saved = keys.get(key)
    if (saved) {
      if (saved.body !== JSON.stringify(body))
        throw new Error('Ключ уже использован для другого перевода.')
      return { ...transfers.get(saved.transferId)! }
    }
    if (body.recipientSub === 'demo-alice') throw new Error('Нельзя перевести деньги самому себе.')
    const transfer: Transfer = {
      transferId: crypto.randomUUID(),
      status: 'PENDING',
      reasonCode: null,
    }
    transfers.set(transfer.transferId, transfer)
    keys.set(key, { body: JSON.stringify(body), transferId: transfer.transferId })
    setTimeout(() => {
      if (!account || account.accountId !== body.fromAccountId) {
        transfer.status = 'REJECTED'
        transfer.reasonCode = 'SOURCE_ACCOUNT_UNAVAILABLE'
      } else if (account.balanceKopecks < body.amountKopecks) {
        transfer.status = 'REJECTED'
        transfer.reasonCode = 'INSUFFICIENT_FUNDS'
      } else {
        account.balanceKopecks -= body.amountKopecks
        transfer.status = 'COMPLETED'
        entries.unshift({
          entryId: crypto.randomUUID(),
          transferId: transfer.transferId,
          deltaKopecks: -body.amountKopecks,
          currency: 'RUB',
          createdAt: new Date().toISOString(),
        })
      }
    }, 2500)
    return { ...transfer }
  },
  async getTransfer(id) {
    await delay()
    const transfer = transfers.get(id)
    if (!transfer) throw new Error('Перевод не найден.')
    return { ...transfer }
  },
}
