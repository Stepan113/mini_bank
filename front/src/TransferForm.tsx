import { useEffect, useRef, useState } from 'react'
import { api, ApiError, errorMessage } from './api'
import { getUser, isDemo } from './auth'
import { formatMoney, parseAmount } from './money'
import type { Account, Transfer, TransferRequest } from './types'

interface Operation {
  key: string
  body: TransferRequest
  handle: string
  createdAt: number
  transfer?: Transfer
}

const rejectionReasons: Record<string, string> = {
  SOURCE_ACCOUNT_UNAVAILABLE: 'Счёт отправителя недоступен.',
  RECIPIENT_ACCOUNT_UNAVAILABLE: 'Счёт получателя недоступен.',
  SAME_ACCOUNT: 'Нельзя переводить деньги на тот же счёт.',
  INSUFFICIENT_FUNDS: 'На счёте недостаточно денег.',
}

function readOperation(storageKey: string, accountId: string): Operation | null {
  if (isDemo) return null
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey) || 'null') as Operation | null
    return saved?.body?.fromAccountId === accountId &&
      typeof saved.key === 'string' &&
      typeof saved.createdAt === 'number'
      ? saved
      : null
  } catch {
    return null
  }
}

export default function TransferForm({
  account,
  onSettled,
}: {
  account: Account
  onSettled: () => Promise<void>
}) {
  const storageKey = `mini-bank:operation:${getUser().sub}`
  const [operation, setOperation] = useState<Operation | null>(() =>
    readOperation(storageKey, account.accountId),
  )
  const [handle, setHandle] = useState(operation?.handle ?? '')
  const [amount, setAmount] = useState(operation ? String(operation.body.amountKopecks / 100) : '')
  const [recipient, setRecipient] = useState<{ recipientSub: string } | null>(
    operation ? { recipientSub: operation.body.recipientSub } : null,
  )
  const [finding, setFinding] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [pollError, setPollError] = useState('')
  const sendingRef = useRef(false)
  const lookupVersion = useRef(0)
  const expired = Boolean(operation && Date.now() - operation.createdAt >= 30 * 24 * 60 * 60 * 1000)
  const transfer = operation?.transfer
  const transferId = transfer?.transferId
  const transferStatus = transfer?.status

  useEffect(() => {
    if (isDemo) return
    try {
      if (operation) sessionStorage.setItem(storageKey, JSON.stringify(operation))
      else sessionStorage.removeItem(storageKey)
    } catch {
      /* Storage may be disabled; retry remains safe while the page is open. */
    }
  }, [operation, storageKey])

  useEffect(() => {
    if (transferStatus !== 'PENDING' || !transferId) return
    const id = transferId
    let active = true
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      let delay = 3000
      try {
        const transfer = await api.getTransfer(id)
        if (!active) return
        setPollError('')
        if (transfer.status !== 'PENDING') {
          setOperation((current) => (current ? { ...current, transfer } : null))
          void onSettled()
          return
        }
      } catch (e) {
        if (!active) return
        setPollError(`${errorMessage(e)} Проверка статуса будет повторена автоматически.`)
        delay = e instanceof ApiError && e.retryAfter ? Math.max(3000, e.retryAfter * 1000) : 10_000
      }
      if (active) timer = setTimeout(() => void poll(), delay)
    }
    timer = setTimeout(() => void poll(), 1500)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [transferId, transferStatus, onSettled])

  async function findRecipient() {
    const normalized = handle.trim()
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
      setError('Введите псевдоним получателя: 3–24 символа a–z, 0–9 или _.')
      return
    }
    const version = ++lookupVersion.current
    setFinding(true)
    setRecipient(null)
    setError('')
    try {
      const found = await api.findRecipient(normalized)
      if (version !== lookupVersion.current) return
      if (found.recipientSub === getUser().sub) {
        setError('Нельзя перевести деньги самому себе.')
        return
      }
      setRecipient(found)
    } catch (e) {
      if (version === lookupVersion.current) setError(errorMessage(e))
    } finally {
      if (version === lookupVersion.current) setFinding(false)
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sendingRef.current || operation?.transfer || expired) return
    const amountKopecks = parseAmount(amount)
    if (!operation && (!recipient || amountKopecks === null)) {
      setError(
        'Найдите получателя и введите сумму от 0,01 до 1 000 000 рублей, не более двух знаков после запятой.',
      )
      return
    }
    const current = operation ?? {
      key: crypto.randomUUID(),
      body: {
        fromAccountId: account.accountId,
        recipientSub: recipient!.recipientSub,
        amountKopecks: amountKopecks!,
        currency: 'RUB' as const,
      },
      handle: handle.trim(),
      createdAt: Date.now(),
    }
    // Save the request before sending it. An uncertain response must reuse its key and body.
    setOperation(current)
    setError('')
    setSending(true)
    sendingRef.current = true
    try {
      const transfer = await api.createTransfer(current.body, current.key)
      setOperation({ ...current, transfer })
      if (transfer.status !== 'PENDING') void onSettled()
    } catch (e) {
      setError(errorMessage(e))
      if (e instanceof ApiError && [400, 403, 404, 422].includes(e.status)) setOperation(null)
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  function reset() {
    setOperation(null)
    setHandle('')
    setAmount('')
    setRecipient(null)
    setError('')
    setPollError('')
  }

  const terminal = transfer && transfer.status !== 'PENDING'
  return (
    <section className="card" aria-labelledby="transfer-title">
      <div className="card-body p-4">
        <h2 id="transfer-title" className="h5 mb-3">
          Перевести деньги
        </h2>
        <form onSubmit={(e) => void submit(e)}>
          <label htmlFor="recipient" className="form-label">
            Псевдоним получателя
          </label>
          <div className="input-group">
            <span className="input-group-text" aria-hidden="true">
              @
            </span>
            <input
              id="recipient"
              className="form-control"
              placeholder="bob_02"
              value={handle}
              maxLength={24}
              autoComplete="off"
              spellCheck={false}
              disabled={Boolean(operation)}
              onChange={(e) => {
                lookupVersion.current++
                setHandle(e.target.value)
                setRecipient(null)
                setFinding(false)
                setError('')
              }}
            />
            <button
              type="button"
              className="btn btn-outline-primary"
              disabled={Boolean(operation) || finding || !handle.trim()}
              onClick={() => void findRecipient()}
            >
              {finding ? 'Поиск…' : 'Найти'}
            </button>
          </div>
          <div className={`form-text mb-3 ${recipient ? 'text-success' : ''}`} role="status">
            {recipient ? `Получатель @${handle.trim()} найден` : 'Спросите псевдоним у получателя.'}
          </div>
          <label htmlFor="amount" className="form-label">
            Сумма в рублях
          </label>
          <div className="input-group mb-2">
            <input
              id="amount"
              className="form-control"
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              maxLength={12}
              disabled={Boolean(operation)}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby="amount-help"
            />
            <span className="input-group-text">₽</span>
          </div>
          <div id="amount-help" className="form-text mb-3">
            От 0,01 до 1 000 000 ₽. Валюта — рубли.
          </div>
          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}
          {operation && !transfer && !sending && !expired && (
            <p className="small text-secondary">
              Ответ о принятии пока не получен. Повторная отправка использует тот же запрос и не
              создаёт новый перевод.
            </p>
          )}
          {expired && !transfer && (
            <div className="alert alert-warning">
              Срок безопасного повтора истёк. Проверьте историю перед созданием нового перевода.
            </div>
          )}
          {!transfer && !expired && (
            <button className="btn btn-primary w-100" disabled={sending || !recipient}>
              {sending ? 'Отправляем…' : operation ? 'Повторить отправку' : 'Отправить перевод'}
            </button>
          )}
        </form>
        {transfer && (
          <div
            className={`alert status-box mt-3 mb-0 ${transfer.status === 'PENDING' ? 'alert-info' : transfer.status === 'COMPLETED' ? 'alert-success' : 'alert-danger'}`}
            role="status"
            aria-live="polite"
          >
            <div className="fw-semibold">
              {transfer.status === 'PENDING'
                ? 'Перевод обрабатывается'
                : transfer.status === 'COMPLETED'
                  ? 'Перевод выполнен'
                  : 'Перевод отклонён'}
            </div>
            <div className="small mt-1">
              {formatMoney(operation!.body.amountKopecks)} → @{operation!.handle}
            </div>
            {transfer.status === 'PENDING' && (
              <div className="small mt-2">
                Проверяем статус автоматически. Дождитесь результата.
              </div>
            )}
            {transfer.status === 'REJECTED' && (
              <div className="small mt-2">
                {rejectionReasons[transfer.reasonCode ?? ''] ??
                  'Не удалось выполнить перевод. Деньги не списаны.'}
              </div>
            )}
            <div className="small text-break mt-2">№ {transfer.transferId}</div>
          </div>
        )}
        {pollError && (
          <div className="alert alert-warning small mt-3 mb-0" role="alert">
            {pollError}
          </div>
        )}
        {(terminal || (expired && !transfer)) && (
          <button className="btn btn-outline-primary w-100 mt-3" onClick={reset}>
            Новый перевод
          </button>
        )}
      </div>
    </section>
  )
}
