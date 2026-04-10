import { useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'

class ErrorBoundary extends Component {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch(err) { console.error('[ErrorBoundary]', err) }
  render() {
    if (this.state.crashed) return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 text-center">
        <p className="text-lg font-semibold text-gray-700">Ocurrió un error inesperado</p>
        <p className="text-sm text-gray-400">Recarga la página para continuar.</p>
        <button
          onClick={() => { this.setState({ crashed: false }); window.location.reload() }}
          className="px-5 py-2 bg-marino text-white text-sm rounded-xl font-medium"
        >
          Recargar
        </button>
      </div>
    )
    return this.props.children
  }
}
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Toast from './components/Toast'
import ActualizadorApp from './components/ActualizadorApp'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginApoderado from './pages/LoginApoderado'
import LoginPersonal  from './pages/LoginPersonal'
import { obtenerUsuario, obtenerRutaPorRol, estaAutenticado } from './lib/auth'
import { iniciarPush, setPushNavigate } from './lib/pushNotifications'
import SinConexion from './components/SinConexion'

// Registra el navigate de React Router en el módulo push para que el tap
// de notificaciones use navegación SPA en vez de window.location.href
function PushNavigateSync() {
  const navigate = useNavigate()
  useEffect(() => {
    setPushNavigate(navigate)
    return () => setPushNavigate(null)
  }, [navigate])
  return null
}

function RootRedirect() {
  if (estaAutenticado()) {
    const usuario = obtenerUsuario()
    if (usuario) return <Navigate to={obtenerRutaPorRol(usuario.rol)} replace />
  }
  return <Navigate to="/login" replace />
}

// Auxiliar
import InicioAuxiliar from './pages/auxiliar/Inicio'
import Escanear from './pages/auxiliar/Escanear'
import Asistencia from './pages/auxiliar/Asistencia'
import Comunicar from './pages/auxiliar/Comunicar'
import Bandeja from './pages/auxiliar/Bandeja'
import JustificacionesAux from './pages/auxiliar/Justificaciones'
import Contactos from './pages/auxiliar/Contactos'
import Inspeccion from './pages/auxiliar/Inspeccion'
import AuxiliarHorarios from './pages/auxiliar/Horarios'
import AuxiliarHorarioClases from './pages/auxiliar/HorarioClases'

// Tutor
import TutorInicio from './pages/tutor/Inicio'
import MiAula from './pages/tutor/MiAula'
import Seguimiento from './pages/tutor/Seguimiento'
import Libretas from './pages/tutor/Libretas'
import Reuniones from './pages/tutor/Reuniones'
import TutorComunicados from './pages/tutor/Comunicados'

// Apoderado
import Inicio from './pages/apoderado/Inicio'
import Asistencias from './pages/apoderado/Asistencias'
import ComunicadosApoderado from './pages/apoderado/Comunicados'
import Justificar from './pages/apoderado/Justificar'
import HorarioApoderado from './pages/apoderado/Horario'
import LibretasApoderado from './pages/apoderado/Libretas'
import ContactoApoderado from './pages/apoderado/Contacto'
import RecojoApoderado from './pages/apoderado/Recojo'

// Perfil compartido
import Perfil from './pages/Perfil'
import DescargarApp from './pages/DescargarApp'

// Admin
import Dashboard from './pages/admin/Dashboard'
import Estudiantes from './pages/admin/Estudiantes'
import Apoderados from './pages/admin/Apoderados'
import Calendario from './pages/admin/Calendario'
import Horarios from './pages/admin/Horarios'
import HorarioClases from './pages/admin/HorarioClases'
import Reportes from './pages/admin/Reportes'
import Usuarios from './pages/admin/Usuarios'
import AdminComunicar from './pages/admin/Comunicar'
import AdminBandeja from './pages/admin/Bandeja'
import AdminRecojo from './pages/admin/Recojo'
import EscanearRecojo from './pages/auxiliar/EscanearRecojo'

const ROLES_AUXILIAR = ['i-auxiliar', 'p-auxiliar', 's-auxiliar']

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 min antes de considerar datos obsoletos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  // Ocultar splash screen nativa cuando React termina el primer render
  useEffect(() => {
    async function hideSplash() {
      if (!window.Capacitor?.isNativePlatform?.()) return
      try {
        const { SplashScreen } = await import(/* @vite-ignore */ '@capacitor/splash-screen')
        await SplashScreen.hide({ fadeOutDuration: 300 })
      } catch (_) {}
    }
    const t = setTimeout(hideSplash, 300)
    return () => clearTimeout(t)
  }, [])

  // Inicializar push al arrancar si ya hay sesión activa (app reabierta sin login)
  useEffect(() => {
    if (estaAutenticado()) {
      iniciarPush().catch(() => {})
    }
  }, [])

  return (
    <SinConexion>
    <QueryClientProvider client={queryClient}>
      <ActualizadorApp />
      <BrowserRouter>
        <PushNavigateSync />
        <Toast />
        <ErrorBoundary>
        <Routes>
          <Route path="/login"    element={<LoginApoderado />} />
          <Route path="/personal" element={<LoginPersonal />} />
          <Route path="/" element={<RootRedirect />} />

          {/* AUXILIAR — ProtectedRoute → Layout → páginas */}
          <Route element={<ProtectedRoute rolesPermitidos={ROLES_AUXILIAR} />}>
            <Route path="/auxiliar" element={<Layout />}>
              <Route index element={<Navigate to="inicio" replace />} />
              <Route path="inicio"          element={<InicioAuxiliar />} />
              <Route path="escanear"        element={<Escanear />} />
              <Route path="recojo"          element={<EscanearRecojo />} />
              <Route path="inspeccion"      element={<Inspeccion />} />
              <Route path="asistencia"      element={<Asistencia />} />
              <Route path="comunicar"       element={<Comunicar />} />
              <Route path="bandeja"         element={<Bandeja />} />
              <Route path="justificaciones" element={<JustificacionesAux />} />
              <Route path="horarios"        element={<AuxiliarHorarios />} />
              <Route path="horario-clases"  element={<AuxiliarHorarioClases />} />
              <Route path="contactos"       element={<Contactos />} />
              <Route path="perfil"          element={<Perfil />} />
              <Route path="descargar-app"   element={<DescargarApp />} />
            </Route>
          </Route>

          {/* TUTOR */}
          <Route element={<ProtectedRoute rolesPermitidos={['tutor']} />}>
            <Route path="/tutor" element={<Layout />}>
              <Route index element={<Navigate to="inicio" replace />} />
              <Route path="inicio"        element={<TutorInicio />} />
              <Route path="mi-aula"       element={<MiAula />} />
              <Route path="seguimiento"   element={<Seguimiento />} />
              <Route path="libretas"      element={<Libretas />} />
              <Route path="reuniones"     element={<Reuniones />} />
              <Route path="comunicados"   element={<TutorComunicados />} />
              <Route path="recojo"        element={<EscanearRecojo />} />
              <Route path="inspeccion"    element={<Inspeccion />} />
              <Route path="perfil"        element={<Perfil />} />
              <Route path="descargar-app" element={<DescargarApp />} />
            </Route>
          </Route>

          {/* APODERADO */}
          <Route element={<ProtectedRoute rolesPermitidos={['apoderado']} />}>
            <Route path="/apoderado" element={<Layout />}>
              <Route index element={<Navigate to="inicio" replace />} />
              <Route path="inicio"      element={<Inicio />} />
              <Route path="asistencias" element={<Asistencias />} />
              <Route path="comunicados" element={<ComunicadosApoderado />} />
              <Route path="libretas"    element={<LibretasApoderado />} />
              <Route path="justificar"  element={<Justificar />} />
              <Route path="horario"     element={<HorarioApoderado />} />
              <Route path="contacto"    element={<ContactoApoderado />} />
              <Route path="recojo"      element={<RecojoApoderado />} />
              <Route path="perfil"      element={<Perfil />} />
              <Route path="descargar-app" element={<DescargarApp />} />
            </Route>
          </Route>

          {/* ADMIN */}
          <Route element={<ProtectedRoute rolesPermitidos={['admin']} />}>
            <Route path="/admin" element={<Layout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard"   element={<Dashboard />} />
              <Route path="estudiantes" element={<Estudiantes />} />
              <Route path="apoderados"  element={<Apoderados />} />
              <Route path="calendario"  element={<Calendario />} />
              <Route path="horarios"       element={<Horarios />} />
              <Route path="horario-clases" element={<HorarioClases />} />
              <Route path="reportes"       element={<Reportes />} />
              <Route path="usuarios"       element={<Usuarios />} />
              <Route path="comunicar"      element={<AdminComunicar />} />
              <Route path="bandeja"        element={<AdminBandeja />} />
              <Route path="recojo"         element={<AdminRecojo />} />
              <Route path="descargar-app"  element={<DescargarApp />} />
            </Route>
          </Route>
        </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
    </SinConexion>
  )
}
