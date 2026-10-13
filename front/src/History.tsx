import { useEffect, useState } from 'react'
import { api, errorMessage } from './api'
import { formatMoney } from './money'
import type { EntriesPage } from './types'

export default function History() {
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const [page, setPage] = useState<EntriesPage>({ items: [], nextCursor: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const cursor = cursors[cursors.length - 1]
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    api
      .getEntries(cursor)
      .then((data) => {
        if (active) setPage(data)
      })
      .catch((e) => {
        if (active) setError(errorMessage(e))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [cursor, retry])

  return (
    <section className="card" aria-labelledby="history-title">
      <div className="card-header p-3 d-flex align-items-center justify-content-between gap-3">
        <h2 id="history-title" className="h5 mb-0">
          История операций
        </h2>
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={loading}
          onClick={() => setRetry((v) => v + 1)}
        >
          Обновить историю
        </button>
      </div>
      {error ? (
        <div className="alert alert-danger m-3" role="alert">
          {error}
        </div>
      ) : loading ? (
        <p className="p-4 mb-0 text-secondary" role="status">
          Загружаем операции…
        </p>
      ) : !page.items.length ? (
        <p className="p-4 mb-0 text-secondary">
          Операций пока нет. Здесь появятся поступления и списания.
        </p>
      ) : (
        <div className="table-responsive">
          <table className="table align-middle mb-0">
            <thead className="table-light">
              <tr>
                <th scope="col">Дата</th>
                <th scope="col">Операция</th>
                <th scope="col" className="text-end">
                  Сумма
                </th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((entry) => (
                <tr key={entry.entryId}>
                  <td>
                    <time dateTime={entry.createdAt}>
                      {new Date(entry.createdAt).toLocaleString('ru-RU', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  </td>
                  <td>
                    {entry.deltaKopecks > 0 ? 'Поступление' : 'Перевод'}
                    <div className="small text-secondary text-break" title={entry.transferId}>
                      № {entry.transferId.slice(0, 8)}
                    </div>
                  </td>
                  <td
                    className={`text-end money fw-medium ${entry.deltaKopecks > 0 ? 'text-success' : ''}`}
                  >
                    {entry.deltaKopecks > 0 ? '+' : ''}
                    {formatMoney(entry.deltaKopecks)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(cursors.length > 1 || page.nextCursor) && (
        <nav
          aria-label="Страницы истории"
          className="card-footer bg-white d-flex align-items-center justify-content-between gap-2 p-3"
        >
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || cursors.length === 1}
            onClick={() => setCursors((items) => items.slice(0, -1))}
          >
            Назад
          </button>
          <span className="small text-secondary">Страница {cursors.length}</span>
          <button
            className="btn btn-outline-secondary btn-sm"
            disabled={loading || Boolean(error) || !page.nextCursor}
            onClick={() => setCursors((items) => [...items, page.nextCursor!])}
          >
            Далее
          </button>
        </nav>
      )}
    </section>
  )
}
