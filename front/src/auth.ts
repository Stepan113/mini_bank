import Keycloak from 'keycloak-js'

export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true'
const {
  VITE_KEYCLOAK_URL: url,
  VITE_KEYCLOAK_REALM: realm,
  VITE_KEYCLOAK_CLIENT_ID: clientId,
} = import.meta.env
export const authConfigured = isDemo || Boolean(url && realm && clientId)
const keycloak = !isDemo && authConfigured ? new Keycloak({ url, realm, clientId }) : null
let initialization: Promise<boolean> | undefined

export function initAuth(): Promise<boolean> {
  if (isDemo) return Promise.resolve(true)
  if (!keycloak) return Promise.resolve(false)
  initialization ??= keycloak.init({
    onLoad: 'check-sso',
    pkceMethod: 'S256',
    checkLoginIframe: false,
  })
  return initialization
}

export function getUser() {
  return isDemo
    ? { sub: 'demo-alice', name: 'Алиса' }
    : {
        sub: keycloak?.subject ?? '',
        name: keycloak?.tokenParsed?.preferred_username ?? 'Пользователь',
      }
}

export async function login() {
  await keycloak?.login({ redirectUri: window.location.origin, locale: 'ru' })
}

export async function logout() {
  await keycloak?.logout({ redirectUri: window.location.origin })
}

export function expireSession() {
  keycloak?.clearToken()
  window.dispatchEvent(new Event('mini-bank:session-expired'))
}

export async function getToken(): Promise<string> {
  if (!keycloak?.authenticated) throw new Error('Войдите в приложение, чтобы продолжить.')
  try {
    await keycloak.updateToken(30)
  } catch {
    expireSession()
    throw new Error('Сессия завершилась. Войдите в приложение ещё раз.')
  }
  if (!keycloak.token) throw new Error('Не удалось получить токен. Войдите ещё раз.')
  return keycloak.token
}
