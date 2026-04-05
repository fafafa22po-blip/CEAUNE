import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Escanear from './pages/auxiliar/Escanear'
import Hoy from './pages/auxiliar/Hoy'
import EstudiantesAuxiliar from './pages/auxiliar/Estudiantes'
import Dashboard from './pages/admin/Dashboard'
import EstudiantesAdmin from './pages/admin/Estudiantes'
import Apoderados from './pages/admin/Apoderados'
import Asistencias from './pages/apoderado/Asistencias'
import ComunicadosAuxiliar from './pages/auxiliar/Comunicados'
import ComunicadosApoderado from './pages/apoderado/Comunicados'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/auxiliar/*"
          element={
            <ProtectedRoute roles={['auxiliar', 'admin']}>
              <Routes>
                <Route path="escanear" element={<Escanear />} />
                <Route path="hoy" element={<Hoy />} />
                <Route path="estudiantes" element={<EstudiantesAuxiliar />} />
                <Route path="comunicados" element={<ComunicadosAuxiliar />} />
                <Route index element={<Navigate to="escanear" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute roles={['admin']}>
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="estudiantes" element={<EstudiantesAdmin />} />
                <Route path="apoderados" element={<Apoderados />} />
                <Route index element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />
        <Route
          path="/apoderado/*"
          element={
            <ProtectedRoute roles={['apoderado']}>
              <Routes>
                <Route path="asistencias" element={<Asistencias />} />
                <Route path="comunicados" element={<ComunicadosApoderado />} />
                <Route index element={<Navigate to="asistencias" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
