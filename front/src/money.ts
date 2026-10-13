export function parseAmount(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized)) return null
  const [rubles, kopecks = ''] = normalized.split('.')
  const amount = Number(rubles) * 100 + Number(kopecks.padEnd(2, '0'))
  return amount >= 1 && amount <= 100_000_000 ? amount : null
}

export function formatMoney(kopecks: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(
    kopecks / 100,
  )
}
