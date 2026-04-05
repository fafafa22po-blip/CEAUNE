import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search, X, Phone, MessageCircle, Copy, Mail,
  PhoneOff, Users, RotateCcw, GraduationCap, Heart,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { abrirWhatsApp } from '../../lib/externo'
import { obtenerUsuario } from '../../lib/auth'

// ─── Config ───────────────────────────────────────────────────────────────────

const NIVEL_CFG = {
  inicial:    { label: 'Inicial',    bg: 'bg-violet-100', text: 'text-violet-700', avatar: 'bg-violet-600' },
  primaria:   { label: 'Primaria',   bg: 'bg-sky-100',    text: 'text-sky-700',    avatar: 'bg-sky-600'    },
  secundaria: { label: 'Secundaria', bg: 'bg-emerald-100',text: 'text-emerald-700',avatar: 'bg-emerald-600'},
}

const NIVEL_POR_ROL = {
  'i-auxiliar': 'inicial',
  'p-auxiliar': 'primaria',
  's-auxiliar': 'secundaria',
}

function iniciales(n = '', a = '') {
  return `${n.charAt(0)}${a.charAt(0)}`.toUpperCase()
}

// ─── Modal de contacto (slim) ─────────────────────────────────────────────────

function ModalContacto({ est, onClose }) {
  const [apoderados, setApoderados] = useState(null)
  const [mensaje, setMensaje]       = useState('')
  const backdropRef                 = useRef()
  const cfg                         = NIVEL_CFG[est.nivel] || NIVEL_CFG.primaria

  const mensajeDefault = useMemo(() =>
    `Estimado/a apoderado/a,\nLe contactamos por asuntos relacionados a *${est.nombre} ${est.apellido}* ` +
    `(${cfg.label} — ${est.grado} "${est.seccion}").\n\n_Colegio CEAUNE_`
  , [est.id]) // eslint-disable-line

  useEffect(() => {
    api.get(`/estudiantes/${est.id}/apoderados`)
      .then(({ data }) => { setApoderados(data); setMensaje(mensajeDefault) })
      .catch(() => setApoderados([]))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [est.id, mensajeDefault])

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const conTelefono = (apoderados || []).filter((a) => a.telefono)
  const sinTelefono = (apoderados || []).filter((a) => !a.telefono)

  const copiar  = (apo) => { navigator.clipboard.writeText(`+51${apo.telefono}`); toast.success('Número copiado') }
  const abrirWA = (apo) => abrirWhatsApp(apo.telefono, mensaje)

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,31,61,0.55)', backdropFilter: 'blur(4px)' }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[88vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className={`${cfg.avatar} px-5 py-4 flex-shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-base">{iniciales(est.nombre, est.apellido)}</span>
              </div>
              <div>
                <p className="text-white font-bold text-base leading-tight">{est.nombre} {est.apellido}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-white/80 text-xs flex items-center gap-1">
                    <GraduationCap size={11} /> {est.grado} · Sec. {est.seccion}
                  </span>
                  <span className="text-white/60 text-xs font-mono">DNI {est.dni}</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>

        {/* Cuerpo */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

          {/* Cargando */}
          {apoderados === null && (
            <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
              <span className="animate-spin w-5 h-5 border-2 border-dorado border-t-transparent rounded-full" />
              <span className="text-sm">Cargando contactos...</span>
            </div>
          )}

          {/* Sin apoderados */}
          {apoderados !== null && apoderados.length === 0 && (
            <div className="text-center py-10">
              <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Users size={22} className="text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-500">Sin apoderados vinculados</p>
              <p className="text-xs text-gray-400 mt-1">Gestiona los apoderados desde el panel Admin</p>
            </div>
          )}

          {/* Lista de apoderados */}
          {apoderados !== null && apoderados.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Users size={12} /> Apoderados
                <span className="bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 text-xs font-bold">{apoderados.length}</span>
              </p>

              {[...conTelefono, ...sinTelefono].map((apo) => (
                <div
                  key={apo.id}
                  className={`rounded-xl border p-3.5 space-y-3 ${
                    apo.telefono ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${
                      apo.telefono ? `${cfg.avatar} text-white` : 'bg-gray-200 text-gray-500'
                    }`}>
                      {iniciales(apo.nombre, apo.apellido)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 leading-none">{apo.nombre} {apo.apellido}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-1 truncate">
                        <Mail size={10} /> {apo.email || 'Sin correo'}
                      </p>
                      {apo.telefono ? (
                        <p className="text-xs text-green-700 font-medium flex items-center gap-1 mt-0.5">
                          <Phone size={10} /> +51 {apo.telefono}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <PhoneOff size={10} /> Sin número registrado
                        </p>
                      )}
                    </div>
                  </div>

                  {apo.telefono && (
                    <div className="flex gap-2">
                      <button onClick={() => copiar(apo)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium rounded-lg transition-colors flex-1">
                        <Copy size={12} /> Copiar
                      </button>
                      <a href={`tel:+51${apo.telefono}`}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium rounded-lg transition-colors flex-1">
                        <Phone size={12} /> Llamar
                      </a>
                      <button onClick={() => abrirWA(apo)}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-colors flex-1 shadow-sm">
                        <MessageCircle size={12} /> WhatsApp
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Salud */}
          {(est.atencion_medica || est.tiene_alergias || est.condicion_mental_nee || est.contacto_emergencia) && (
            <div className="space-y-2.5 border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Heart size={12} /> Información de salud
              </p>
              {est.tiene_alergias && (
                <div className="bg-red-50 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs font-semibold text-red-700">⚠️ Alergias: <span className="font-normal">{est.alergias_detalle || 'Sin detalle'}</span></p>
                </div>
              )}
              {est.contacto_emergencia && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs font-semibold text-orange-700 mb-0.5">📞 Contacto de emergencia</p>
                  <p className="text-xs text-gray-700">{est.contacto_emergencia}</p>
                </div>
              )}
              {est.atencion_medica && (
                <div className="bg-sky-50 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs font-semibold text-sky-700">🏥 Atención médica: <span className="font-normal">{est.atencion_medica}</span></p>
                </div>
              )}
              {est.condicion_mental_nee && (
                <div className="bg-purple-50 rounded-xl px-3.5 py-2.5">
                  <p className="text-xs font-semibold text-purple-700">🧠 Salud mental / NEE: <span className="font-normal">{est.condicion_mental_nee}</span></p>
                </div>
              )}
            </div>
          )}

          {/* Mensaje WhatsApp editable */}
          {conTelefono.length > 0 && (
            <div className="space-y-2 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageCircle size={12} /> Mensaje para WhatsApp
                </p>
                <button
                  onClick={() => setMensaje(mensajeDefault)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-marino transition-colors"
                >
                  <RotateCcw size={11} /> Restaurar
                </button>
              </div>
              <div className="relative">
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-400/40 focus:border-green-400 transition-all bg-gray-50"
                  rows={4}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                />
                <span className="absolute bottom-2.5 right-3 text-xs text-gray-300">{mensaje.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between rounded-b-2xl flex-shrink-0">
          <p className="text-xs text-gray-400">
            {conTelefono.length > 0
              ? `${conTelefono.length} contacto${conTelefono.length !== 1 ? 's' : ''} con WhatsApp`
              : 'Sin números registrados'}
          </p>
          <button onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium px-4 py-1.5 rounded-xl hover:bg-gray-200 transition-colors">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Contactos() {
  const nivelPropio = useMemo(() => {
    const u = obtenerUsuario()
    return NIVEL_POR_ROL[u?.rol] || null
  }, [])

  const [todos, setTodos]               = useState([])
  const [cargando, setCargando]         = useState(true)
  const [busqueda, setBusqueda]         = useState('')
  const [filtroGrado, setFiltroGrado]   = useState('')
  const [filtroSeccion, setFiltroSeccion] = useState('')
  const [seleccionado, setSeleccionado] = useState(null)

  const cfg = nivelPropio ? NIVEL_CFG[nivelPropio] : null

  // Carga todos los alumnos del nivel al entrar
  useEffect(() => {
    const params = {}
    if (nivelPropio) params.nivel = nivelPropio
    api.get('/estudiantes/', { params })
      .then(({ data }) => setTodos(Array.isArray(data) ? data : (data.items || [])))
      .catch(() => toast.error('Error al cargar alumnos'))
      .finally(() => setCargando(false))
  }, [nivelPropio])

  // Grados únicos ordenados numéricamente
  const grados = useMemo(() =>
    [...new Set(todos.map((e) => e.grado).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  , [todos])

  // Secciones del grado seleccionado, ordenadas alfabéticamente
  const seccionesDelGrado = useMemo(() =>
    [...new Set(todos.filter((e) => e.grado === filtroGrado).map((e) => e.seccion).filter(Boolean))].sort()
  , [todos, filtroGrado])

  // Filtrado client-side (instantáneo)
  const filtrados = useMemo(() => {
    return todos.filter((e) => {
      if (filtroGrado   && e.grado   !== filtroGrado)   return false
      if (filtroSeccion && e.seccion !== filtroSeccion)  return false
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase()
        return `${e.nombre} ${e.apellido}`.toLowerCase().includes(q) || e.dni?.includes(q)
      }
      return true
    })
  }, [todos, filtroGrado, filtroSeccion, busqueda])

  const seleccionarGrado = (g) => {
    if (filtroGrado === g) { setFiltroGrado(''); setFiltroSeccion('') }
    else                   { setFiltroGrado(g);  setFiltroSeccion('') }
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <span className="animate-spin w-6 h-6 border-2 border-dorado border-t-transparent rounded-full mr-3" />
      Cargando directorio...
    </div>
  )

  return (
    <div className="space-y-5">

      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-marino">Directorio</h1>
          <p className="text-xs text-gray-400 mt-0.5">Contacta al apoderado de cualquier alumno</p>
        </div>
        {cfg && (
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${cfg.bg} ${cfg.text}`}>
            {cfg.label} · {todos.length} alumnos
          </span>
        )}
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          className="w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-10 py-3.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-marino/30 focus:border-marino transition-all shadow-sm"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, apellido o DNI..."
        />
        {busqueda && (
          <button onClick={() => setBusqueda('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Selector de aula — cascada: primero grado, luego sección */}
      <div className="space-y-2">

        {/* Fila 1: grados (siempre visible) */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => { setFiltroGrado(''); setFiltroSeccion('') }}
            className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
              !filtroGrado
                ? 'bg-marino text-white border-transparent shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            Todos
          </button>
          {grados.map((g) => (
            <button
              key={g}
              onClick={() => seleccionarGrado(g)}
              className={`px-4 py-2 rounded-full text-xs font-semibold border transition-all ${
                filtroGrado === g
                  ? `${cfg?.avatar || 'bg-marino'} text-white border-transparent shadow-sm`
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              {g}°
            </button>
          ))}
        </div>

        {/* Fila 2: secciones (solo aparece cuando hay grado seleccionado) */}
        {filtroGrado && (
          <div className="flex gap-2 flex-wrap pl-1">
            <button
              onClick={() => setFiltroSeccion('')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                !filtroSeccion
                  ? `${cfg?.avatar || 'bg-marino'} text-white border-transparent shadow-sm`
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              Todas las secciones
            </button>
            {seccionesDelGrado.map((s) => (
              <button
                key={s}
                onClick={() => setFiltroSeccion(filtroSeccion === s ? '' : s)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filtroSeccion === s
                    ? `${cfg?.avatar || 'bg-marino'} text-white border-transparent shadow-sm`
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                Sec. {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contador */}
      <p className="text-xs text-gray-400 px-1">
        Mostrando <span className="font-semibold text-marino">{filtrados.length}</span> de{' '}
        <span className="font-semibold text-marino">{todos.length}</span> alumnos
        {filtroGrado && (
          <span className="ml-1">· {filtroGrado}°{filtroSeccion ? ` Sec. ${filtroSeccion}` : ''}</span>
        )}
      </p>

      {/* Lista de alumnos */}
      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={32} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium">Sin resultados</p>
          <p className="text-xs mt-1">Prueba con otro nombre, DNI o filtro</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          {filtrados.map((est, idx) => {
            const c = NIVEL_CFG[est.nivel] || NIVEL_CFG.primaria
            return (
              <div
                key={est.id}
                className={`flex items-center justify-between px-4 py-3.5 hover:bg-gray-50 transition-colors cursor-pointer ${
                  idx !== filtrados.length - 1 ? 'border-b border-gray-50' : ''
                }`}
                onClick={() => setSeleccionado(est)}
              >
                {/* Alumno */}
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${c.avatar}`}>
                    {iniciales(est.nombre, est.apellido)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 leading-none">
                      {est.nombre} {est.apellido}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
                        {est.grado}
                      </span>
                      <span className="text-xs text-gray-400">Sec. {est.seccion}</span>
                      <span className="text-xs text-gray-300 font-mono">{est.dni}</span>
                    </div>
                  </div>
                </div>

                {/* Acción */}
                <button
                  onClick={(e) => { e.stopPropagation(); setSeleccionado(est) }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${c.bg} ${c.text} hover:opacity-80`}
                >
                  <Phone size={13} /> Contactar
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de contacto */}
      {seleccionado && (
        <ModalContacto est={seleccionado} onClose={() => setSeleccionado(null)} />
      )}

    </div>
  )
}
