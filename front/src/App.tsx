import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from './api'
import { authConfigured, getUser, initAuth, isDemo, login, logout } from './auth'
import { formatMoney } from './money'
import type { Account } from './types'
import History from './History'
import TransferForm from './TransferForm'

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    initAuth()
      .then((value) => {
        if (active) setAuthenticated(value)
      })
      .catch(() => {
        if (active) {
          setAuthenticated(false)
          setError('Не удалось подключиться к серверу входа. Попробуйте обновить страницу.')
        }
      })
    const expired = () => {
      setAuthenticated(false)
      setError('Сессия завершилась. Войдите ещё раз.')
    }
    window.addEventListener('mini-bank:session-expired', expired)
    return () => {
      active = false
      window.removeEventListener('mini-bank:session-expired', expired)
    }
  }, [])

  return (
    <>
      <header className="bg-white border-bottom">
        <div className="container app-container py-3 d-flex align-items-center justify-content-between gap-3">
          <span className="fs-4 fw-semibold">Мини-банк</span>
          {authenticated && (
            <div className="d-flex align-items-center gap-3">
              <span className="text-secondary small">{getUser().name}</span>
              {isDemo ? (
                <span className="badge text-bg-warning">Демо</span>
              ) : (
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => void logout().catch((e) => setError(errorMessage(e)))}
                >
                  Выйти
                </button>
              )}
            </div>
          )}
        </div>
      </header>
      <main className="container app-container py-4 py-md-5">
        {authenticated === null ? (
          <p role="status" className="text-secondary">
            Загрузка…
          </p>
        ) : authenticated ? (
          <>
            {isDemo && (
              <div className="alert alert-warning small">
                Деморежим: виртуальные деньги, данные сбрасываются при обновлении страницы.
                Получатели: <strong>bob_02</strong> и <strong>charlie_03</strong>.
              </div>
            )}
            {error && (
              <div className="alert alert-danger" role="alert">
                {error}
              </div>
            )}
            <Dashboard />
          </>
        ) : (
          <section className="card login-card">
            <div className="card-body p-4">
              <h1 className="h3 mb-3">Добро пожаловать</h1>
              <p className="text-secondary">
                Войдите, чтобы открыть счёт, перевести деньги и посмотреть историю операций.
              </p>
              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}
              {authConfigured ? (
                <button
                  className="btn btn-primary w-100"
                  onClick={() => void login().catch((e) => setError(errorMessage(e)))}
                >
                  Войти
                </button>
              ) : (
                <div className="alert alert-info mb-0">
                  Подключение ещё не настроено. Укажите параметры Keycloak в <code>.env</code> по
                  примеру из <code>.env.example</code>.
                  <div className="mt-2">
                    Посмотреть интерфейс без сервера: <code>npm run demo</code>.
                  </div>
                </div>
              )}
              <p className="small text-secondary mt-3 mb-0">
                Регистрация доступна на странице входа, если она включена в Keycloak.
              </p>
            </div>
          </section>
        )}
      </main>
      <footer className="container app-container pb-4 text-secondary small">
        Учебный проект · Все деньги виртуальные
      </footer>
    </>
  )
}

function Dashboard() {
  const [account, setAccount] = useState<Account | null>()
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [handle, setHandle] = useState('')
  const [creating, setCreating] = useState(false)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try {
      setAccount(await api.getAccount())
      setError('')
      setHistoryVersion((v) => v + 1)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (creating) return
    setCreating(true)
    setError('')
    try {
      setAccount(await api.createAccount(handle.trim()))
      setHistoryVersion((v) => v + 1)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div className="d-flex justify-content-between align-items-center gap-3 mb-4">
        <h1 className="h3 mb-0">Личный кабинет</h1>
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={refreshing}
          onClick={() => void refresh()}
        >
          {refreshing ? 'Обновление…' : 'Обновить'}
        </button>
      </div>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {account === undefined ? (
        <p role="status" className="text-secondary">
          {error ? 'Не удалось загрузить счёт. Нажмите «Обновить».' : 'Загружаем счёт…'}
        </p>
      ) : !account ? (
        <section className="card">
          <div className="card-body p-4">
            <h2 className="h5">Откройте свой счёт</h2>
            <p className="text-secondary">
              Выберите псевдоним: друзья смогут отправлять вам переводы по нему. Изменить его позже
              нельзя.
            </p>
            <form onSubmit={(e) => void createAccount(e)} style={{ maxWidth: 440 }}>
              <label htmlFor="new-handle" className="form-label">
                Ваш псевдоним
              </label>
              <input
                id="new-handle"
                className="form-control"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                pattern="[a-z0-9_]{3,24}"
                minLength={3}
                maxLength={24}
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="alice_01"
                aria-describedby="handle-help"
                disabled={creating}
              />
              <div id="handle-help" className="form-text mb-3">
                От 3 до 24 символов: строчные латинские буквы, цифры и _.
              </div>
              <button className="btn btn-primary" disabled={creating}>
                {creating ? 'Создаём…' : 'Открыть счёт'}
              </button>
            </form>
          </div>
        </section>
      ) : (
        <>
          <div className="row g-4 align-items-start mb-4">
            <div className="col-lg-5">
              <section className="card">
                <div className="card-body p-4">
                  <h2 className="h6 text-secondary">Ваш баланс</h2>
                  <div className="balance mb-4">{formatMoney(account.balanceKopecks)}</div>
                  <div className="small text-secondary mb-1">Псевдоним для переводов</div>
                  <div className="fw-semibold mb-3">@{account.recipientHandle}</div>
                  <div className="small text-secondary mb-1">Номер счёта</div>
                  <div className="account-id text-secondary">{account.accountId}</div>
                </div>
              </section>
            </div>
            <div className="col-lg-7">
              <TransferForm account={account} onSettled={refresh} />
            </div>
          </div>
          <History key={historyVersion} />
        </>
      )}
    </>
  )
}
