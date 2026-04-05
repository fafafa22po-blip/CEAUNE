export function getUser() {
  try {
    const raw = localStorage.getItem('ceaune_user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function getToken() {
  return localStorage.getItem('ceaune_token')
}

export function setSession(token, user) {
  localStorage.setItem('ceaune_token', token)
  localStorage.setItem('ceaune_user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('ceaune_token')
  localStorage.removeItem('ceaune_user')
}

export function isAuthenticated() {
  return !!getToken()
}

export function getRedirectByRole(rol) {
  const routes = {
    admin: '/admin',
    auxiliar: '/auxiliar',
    apoderado: '/apoderado',
  }
  return routes[rol] || '/login'
}
