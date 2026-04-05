export const obtenerUsuario = () => {
  try {
    const data = localStorage.getItem('usuario')
    return data ? JSON.parse(data) : null
  } catch {
    return null
  }
}

export const guardarSesion = (token, usuario) => {
  localStorage.setItem('token', token)
  localStorage.setItem('usuario', JSON.stringify(usuario))
}

export const guardarModoSesion = (modo) => {
  localStorage.setItem('modo_sesion', modo)
}

export const cerrarSesion = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('usuario')
  localStorage.removeItem('modo_sesion')
}

export const estaAutenticado = () => !!localStorage.getItem('token')

export const obtenerRutaPorRol = (rol) => {
  const modo = localStorage.getItem('modo_sesion')
  if (modo === 'apoderado') return '/apoderado'

  const rutas = {
    'admin':      '/admin',
    'i-auxiliar': '/auxiliar',
    'p-auxiliar': '/auxiliar',
    's-auxiliar': '/auxiliar',
    'tutor':      '/tutor',
    'apoderado':  '/apoderado',
  }
  return rutas[rol] || '/login'
}
