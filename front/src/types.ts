export interface Account {
  accountId: string
  recipientHandle: string
  balanceKopecks: number
  currency: 'RUB'
}

export interface Entry {
  entryId: string
  transferId: string
  deltaKopecks: number
  currency: 'RUB'
  createdAt: string
}

export interface EntriesPage {
  items: Entry[]
  nextCursor: string | null
}

export interface TransferRequest {
  fromAccountId: string
  recipientSub: string
  amountKopecks: number
  currency: 'RUB'
}

export interface Transfer {
  transferId: string
  status: 'PENDING' | 'COMPLETED' | 'REJECTED'
  reasonCode?: string | null
}

export interface BankApi {
  getAccount(): Promise<Account | null>
  createAccount(handle: string): Promise<Account>
  getEntries(cursor?: string): Promise<EntriesPage>
  findRecipient(handle: string): Promise<{ recipientSub: string }>
  createTransfer(body: TransferRequest, key: string): Promise<Transfer>
  getTransfer(id: string): Promise<Transfer>
}
