import { Navigate } from 'react-router-dom'
import { getUser, isAuthenticated } from '../lib/auth'

export default function ProtectedRoute({ children, roles = [] }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />
  }

  const user = getUser()
  if (roles.length > 0 && !roles.includes(user?.rol)) {
    return <Navigate to="/login" replace />
  }

  return children
}
