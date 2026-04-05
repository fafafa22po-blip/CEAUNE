import { Navigate, Outlet } from 'react-router-dom'
import { estaAutenticado, obtenerUsuario } from '../lib/auth'

export default function ProtectedRoute({ rolesPermitidos }) {
  if (!estaAutenticado()) return <Navigate to="/login" replace />

  if (rolesPermitidos) {
    const usuario = obtenerUsuario()
    if (!usuario) return <Navigate to="/login" replace />

    const accesoPorRol = rolesPermitidos.includes(usuario.rol)
    const accesoPorApoderado =
      rolesPermitidos.includes('apoderado') &&
      usuario.es_apoderado &&
      localStorage.getItem('modo_sesion') === 'apoderado'

    if (!accesoPorRol && !accesoPorApoderado) {
      return <Navigate to="/login" replace />
    }
  }

  return <Outlet />
}
