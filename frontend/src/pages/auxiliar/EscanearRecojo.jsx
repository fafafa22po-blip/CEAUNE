import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ShieldCheck, ShieldX, Hash, Clock,
  CheckCircle2, AlertTriangle, UserX,
  ScanLine, BarChart2, RefreshCw, Users, LogOut,
} from 'lucide-react'
import toast from 'react-hot-toast'
import QRScanner from '../../components/QRScanner'
import api from '../../lib/api'
import { hapticMedium, hapticLight } from '../../lib/haptics'

const AUTO_CIERRE = 10

// ── Foto con inicial de fallback ───────────────────────────────────────────────
function Avatar({ foto_url, nombre, className = '', textClass = '' }) {
  if (foto_url) {
    return <img src={foto_url} alt={nombre} className={`object-cover ${className}`} />
  }
  return (
    <div className={`flex items-center justify-center font-black text-white/70 ${textClass} ${className}`}>
      {nombre?.charAt(0)?.toUpperCase() || '?'}
    </div>
  )
}

// ── Contador circular SVG ──────────────────────────────────────────────────────
function ContadorCircular({ segundos, total, color }) {
  const r   = 18
  const circ = 2 * Math.PI * r
  const dash = circ * (segundos / total)
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="rotate-[-90deg]">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
      <circle
        cx="22" cy="22" r={r} fill="none"
        stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.9s linear' }}
      />
    </svg>
  )
}

// ── Modal de resultado rediseñado ──────────────────────────────────────────────
function PantallaResultado({ resultado, onCerrar }) {
  const [fase, setFase]     = useState('viendo')   // 'viendo' | 'confirmando' | 'exito'
  const [cuenta, setCuenta] = useState(AUTO_CIERRE)
  const [pausado, setPausado] = useState(false)
  const timerRef = useRef(null)

  const {
    autorizado, estado, vencido,
    ya_recogido, recogido_a_las, recogido_por,
    alumno_presente, alumno_hora_ingreso,
    log_id, persona, estudiante,
  } = resultado

  useEffect(() => { hapticMedium() }, [])

  const conCuenta = (!autorizado || fase === 'exito') && !pausado
  useEffect(() => {
    if (!conCuenta) return
    if (cuenta <= 0) { onCerrar(); return }
    timerRef.current = setTimeout(() => setCuenta(c => c - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [conCuenta, cuenta, onCerrar])

  const confirmarEntrega = async () => {
    if (!log_id) return
    setFase('confirmando')
    try {
      await api.post(`/recojo/confirmar/${log_id}`, {})
      hapticMedium()
      setFase('exito')
      setCuenta(AUTO_CIERRE)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error al confirmar')
      setFase('viendo')
    }
  }

  const ok = autorizado

  // Paleta según el caso
  const paleta = ya_recogido
    ? { ring: 'ring-blue-500', badge: 'bg-blue-600', alumno: 'bg-blue-50 border-blue-100' }
    : ok
    ? { ring: 'ring-green-500', badge: 'bg-green-600', alumno: 'bg-green-50 border-green-100' }
    : { ring: 'ring-red-500',   badge: 'bg-red-600',   alumno: 'bg-red-50 border-red-100'   }

  const motivoNoAuth = vencido
    ? 'Fotocheck vencido — no válido'
    : estado === 'revocado'
    ? 'Fotocheck revocado por el colegio'
    : estado === 'pendiente'
    ? 'Fotocheck pendiente de activación'
    : 'No figura como autorizado'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,10,20,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={() => { setPausado(true); if (!ok || fase === 'exito') onCerrar() }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl"
        onClick={e => { e.stopPropagation(); setPausado(true) }}
      >

        {/* ── Fase éxito ────────────────────────────────────────────── */}
        {fase === 'exito' && (
          <>
            <div className="bg-green-600 flex flex-col items-center justify-center py-8 gap-3">
              <div className="w-16 h-16 rounded-full bg-white/20 ring-4 ring-green-300 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-white" />
              </div>
              <p className="text-white font-black text-2xl">Entrega confirmada</p>
              <p className="text-white/80 text-sm">
                {persona?.nombre} {persona?.apellido} llevó a {estudiante?.nombre}
              </p>
            </div>
            <div className="px-4 py-4">
              <button
                onClick={onCerrar}
                className="w-full py-3 rounded-2xl font-bold text-sm text-white bg-green-600 flex items-center justify-center gap-2.5"
              >
                <span>Escanear siguiente ({cuenta})</span>
                <ContadorCircular segundos={cuenta} total={AUTO_CIERRE} color="#86efac" />
              </button>
            </div>
          </>
        )}

        {/* ── Fase normal (viendo / confirmando) ───────────────────── */}
        {fase !== 'exito' && (
          <>
            {/* Foto grande */}
            <div className="relative">
              <div
                className={`w-full aspect-[4/3] overflow-hidden ring-4 ${paleta.ring}`}
                style={{ background: '#111' }}
              >
                <Avatar
                  foto_url={persona?.foto_url}
                  nombre={persona?.nombre}
                  className="w-full h-full"
                  textClass="text-7xl bg-gray-800 w-full h-full"
                />
              </div>

              {/* Gradiente + nombre sobre la foto */}
              <div
                className="absolute bottom-0 left-0 right-0 h-28"
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)' }}
              />
              <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                <p className="text-white font-black text-xl leading-tight drop-shadow">
                  {persona?.nombre} {persona?.apellido}
                </p>
                <p className="text-white/70 text-sm mt-0.5">
                  {persona?.parentesco} · DNI {persona?.dni}
                </p>
              </div>

              {/* Badge estado */}
              <div className={`absolute top-3 right-3 ${paleta.badge} px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg`}>
                {ya_recogido
                  ? <CheckCircle2 className="w-4 h-4 text-white" />
                  : ok
                  ? <ShieldCheck  className="w-4 h-4 text-white" />
                  : <ShieldX      className="w-4 h-4 text-white" />
                }
                <span className="text-white font-black text-xs tracking-wide">
                  {ya_recogido ? 'YA RECOGIDO' : ok ? 'AUTORIZADO' : 'NO AUTORIZADO'}
                </span>
              </div>
            </div>

            {/* Datos */}
            <div className="px-4 pt-3 pb-1 space-y-2.5">

              {/* Caso: ya recogido — quién lo recogió */}
              {ya_recogido && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-2xl px-3 py-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-blue-200">
                    {recogido_por?.foto_snapshot
                      ? <img src={recogido_por.foto_snapshot} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center font-bold text-blue-600 text-base">
                          {recogido_por?.nombre?.charAt(0) || '?'}
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-900 font-bold text-sm">
                      Alumno ya fue recogido{recogido_a_las ? ` a las ${recogido_a_las}` : ''}
                    </p>
                    {recogido_por && (
                      <p className="text-blue-700 text-xs mt-0.5">
                        Por {recogido_por.nombre} {recogido_por.apellido}
                        <span className="text-blue-500"> · {recogido_por.parentesco}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Vigencia — solo si autorizado */}
              {ok && persona?.vigencia_hasta && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                  <span>
                    Vigente hasta{' '}
                    <strong className="text-gray-700">
                      {new Date(persona.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'long', year: 'numeric',
                      })}
                    </strong>
                  </span>
                </div>
              )}

              {/* Alerta no autorizado — excluye ya_recogido */}
              {!ok && !ya_recogido && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-semibold text-xs">{motivoNoAuth}</p>
                    <p className="text-red-600 text-xs mt-0.5">
                      No entregar al alumno. Avisar a secretaría de inmediato.
                    </p>
                  </div>
                </div>
              )}

              {/* Advertencia alumno sin ingreso */}
              {ok && !alumno_presente && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-800 text-xs font-medium">
                    El alumno no tiene ingreso registrado hoy. Verificar con la docente.
                  </p>
                </div>
              )}

              <div className="h-px bg-gray-100" />

              {/* Alumno */}
              {estudiante && (
                <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${paleta.alumno}`}>
                  <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200 ring-1 ring-gray-200">
                    <Avatar
                      foto_url={estudiante.foto_url}
                      nombre={estudiante.nombre}
                      className="w-full h-full"
                      textClass="text-xl bg-gray-300 w-full h-full"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm leading-tight">
                      {estudiante.nombre} {estudiante.apellido}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {estudiante.nivel === 'inicial'
                        ? `Inicial · ${estudiante.grado} años · Aula ${estudiante.seccion}`
                        : `${estudiante.nivel} · ${estudiante.grado}° "${estudiante.seccion}"`
                      }
                      {alumno_hora_ingreso && (
                        <span className="text-green-600 font-medium"> · Ingresó {alumno_hora_ingreso}</span>
                      )}
                    </p>
                  </div>
                  {ya_recogido
                    ? <CheckCircle2 className="w-5 h-5 text-blue-500  flex-shrink-0" />
                    : ok
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    : <UserX        className="w-5 h-5 text-red-400   flex-shrink-0" />
                  }
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="px-4 pb-4 pt-2.5 space-y-2">
              {/* Confirmar entrega — solo si autorizado */}
              {ok && (
                <button
                  onClick={confirmarEntrega}
                  disabled={fase === 'confirmando'}
                  className="w-full py-3 rounded-2xl font-black text-sm text-white bg-green-600 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {fase === 'confirmando'
                    ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirmando...</>
                    : <><ShieldCheck className="w-4 h-4" /> Confirmar entrega</>
                  }
                </button>
              )}

              {/* Cerrar */}
              <button
                onClick={() => { setPausado(true); onCerrar() }}
                className={`w-full py-2.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 ${
                  ok          ? 'border border-gray-200 text-gray-500' :
                  ya_recogido ? 'text-white bg-blue-600' :
                                'text-white bg-red-600'
                }`}
              >
                {ok
                  ? 'Cancelar'
                  : (
                    <>
                      <span>{pausado ? 'Cerrar' : `Cerrar (${cuenta})`}</span>
                      {!pausado && <ContadorCircular segundos={cuenta} total={AUTO_CIERRE} color="#fca5a5" />}
                    </>
                  )
                }
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ── Panel resumen del día ─────────────────────────────────────────────────────
function StatCard({ valor, label, color, icon: Icon }) {
  const colores = {
    marino: 'bg-[#0a1f3d] text-white',
    green:  'bg-green-600 text-white',
    amber:  'bg-amber-500 text-white',
  }
  return (
    <div className={`${colores[color]} rounded-2xl p-3.5 flex flex-col gap-1 flex-1`}>
      <div className="flex items-center justify-between">
        <span className="text-3xl font-black leading-none">{valor}</span>
        <Icon className="w-5 h-5 opacity-70" />
      </div>
      <span className="text-xs font-medium opacity-80 leading-tight">{label}</span>
    </div>
  )
}

function FilaEstudiante({ foto_url, nombre, apellido, nivel, grado, seccion, badge, badgeColor, hora }) {
  const aula = nivel === 'inicial'
    ? `${grado} años · Aula ${seccion}`
    : `${grado}° "${seccion}"`
  return (
    <div className="flex items-center gap-3 py-2.5 px-1">
      <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200">
        {foto_url
          ? <img src={foto_url} alt={nombre} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center font-bold text-gray-400 text-base">
              {nombre?.charAt(0) || '?'}
            </div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-tight truncate">
          {nombre} {apellido}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{aula}</p>
      </div>
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {hora && <span className="text-xs font-mono text-gray-400">{hora}</span>}
        {badge && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
    </div>
  )
}

function PanelResumen({ onVolver }) {
  const [datos, setDatos]       = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const { data } = await api.get('/recojo/resumen-hoy')
      setDatos(data)
    } catch {
      toast.error('No se pudo cargar el resumen')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-[#0a1f3d] px-4 pt-3 pb-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <BarChart2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Resumen del día</p>
              <p className="text-white/50 text-xs">
                {datos
                  ? new Date(datos.fecha + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long' })
                  : 'Cargando...'
                }
              </p>
            </div>
          </div>
          <button
            onClick={cargar}
            disabled={cargando}
            className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 text-white ${cargando ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats */}
        {datos && (
          <div className="flex gap-2">
            <StatCard valor={datos.total_presentes}  label="Presentes hoy"      color="marino" icon={Users}       />
            <StatCard valor={datos.total_recogidos}  label="Ya recogidos"       color="green"  icon={CheckCircle2} />
            <StatCard valor={datos.total_pendientes} label="Pendientes de recojo" color="amber" icon={Clock}       />
          </div>
        )}
        {cargando && !datos && (
          <div className="flex gap-2">
            {[1,2,3].map(i => <div key={i} className="flex-1 h-20 bg-white/10 rounded-2xl animate-pulse" />)}
          </div>
        )}
      </div>

      {/* Contenido scrollable */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-5">

        {/* Pendientes */}
        {datos && datos.pendientes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-100 bg-amber-50">
              <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm font-bold text-amber-800">
                Pendientes de recojo
                <span className="ml-2 text-xs bg-amber-600 text-white px-2 py-0.5 rounded-full">
                  {datos.pendientes.length}
                </span>
              </p>
            </div>
            <div className="divide-y divide-gray-50 px-3">
              {datos.pendientes.map((p, i) => (
                <FilaEstudiante
                  key={i}
                  {...p.estudiante}
                  hora={p.hora_ingreso ? `Ingresó ${p.hora_ingreso}` : ''}
                  badge="Esperando"
                  badgeColor="bg-amber-100 text-amber-700"
                />
              ))}
            </div>
          </div>
        )}

        {/* Recogidos */}
        {datos && datos.recogidos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-green-100 bg-green-50">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-sm font-bold text-green-800">
                Ya recogidos
                <span className="ml-2 text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
                  {datos.recogidos.length}
                </span>
              </p>
            </div>
            <div className="divide-y divide-gray-50 px-3">
              {datos.recogidos.map((r, i) => (
                <div key={i} className="py-2.5">
                  <FilaEstudiante
                    {...r.estudiante}
                    hora={r.hora}
                    badge="Recogido"
                    badgeColor="bg-green-100 text-green-700"
                  />
                  {/* Responsable que recogió */}
                  <div className="ml-[52px] mt-1 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                      {r.responsable.foto_snapshot
                        ? <img src={r.responsable.foto_snapshot} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-gray-400">
                            {r.responsable.nombre?.charAt(0) || '?'}
                          </div>
                      }
                    </div>
                    <p className="text-xs text-gray-500">
                      {r.responsable.nombre} {r.responsable.apellido}
                      <span className="text-gray-400"> · {r.responsable.parentesco}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {datos && datos.total_presentes === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Sin ingresos registrados hoy</p>
          </div>
        )}

      </div>

      {/* Tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex pb-safe">
        <button
          onClick={onVolver}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-gray-400"
        >
          <ScanLine className="w-5 h-5" />
          <span className="text-[10px] font-medium">Escanear</span>
        </button>
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-[#0a1f3d]">
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] font-bold">Resumen</span>
        </button>
      </div>
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EscanearRecojo() {
  const [modo, setModo]             = useState('camara')   // camara | resultado | resumen
  const [cargando, setCargando]     = useState(false)
  const [camaraActiva, setCamaraActiva] = useState(true)
  const [resultado, setResultado]   = useState(null)
  const [dniManual, setDniManual]   = useState('')

  const escanear = useCallback(async (token) => {
    if (cargando) return
    setCargando(true)
    setCamaraActiva(false)
    try {
      const { data } = await api.post('/recojo/escanear', { qr_token: token })
      hapticLight()
      setResultado(data)
      setModo('resultado')
    } catch (err) {
      const msg = err.response?.data?.detail || 'QR no reconocido'
      toast.error(msg)
      setCamaraActiva(true)
    } finally {
      setCargando(false)
    }
  }, [cargando])

  const cerrarResultado = useCallback(() => {
    setResultado(null)
    setModo('camara')
    setCamaraActiva(true)
  }, [])

  const irResumen = () => {
    setModo('resumen')
    setCamaraActiva(false)
  }

  const volverCamara = () => {
    setModo('camara')
    setCamaraActiva(true)
  }

  const enviarManual = () => {
    const t = dniManual.trim()
    if (!t) return
    setDniManual('')
    escanear(t)
  }

  // ── Vista: resultado ───────────────────────────────────────────────────────
  if (modo === 'resultado' && resultado) {
    return <PantallaResultado resultado={resultado} onCerrar={cerrarResultado} />
  }

  // ── Vista: resumen del día ─────────────────────────────────────────────────
  if (modo === 'resumen') {
    return <PanelResumen onVolver={volverCamara} />
  }

  // ── Vista: cámara ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-3 bg-gray-950 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-green-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm">Recojo Seguro</p>
            <p className="text-gray-400 text-xs">Escanea el fotocheck del apoderado</p>
          </div>
        </div>

        <button
          onClick={irResumen}
          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"
          title="Ver resumen del día"
        >
          <BarChart2 className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Scanner */}
      <div className="flex-1 relative overflow-hidden">
        {camaraActiva && (
          <QRScanner
            activo={camaraActiva}
            onResult={escanear}
          />
        )}

        {cargando && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        )}

        {/* Overlay instrucción */}
        {!cargando && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
            {/* Marco de escaneo */}
            <div className="relative w-64 h-64">
              <div className="absolute top-0 left-0 w-10 h-10 border-l-4 border-t-4 border-green-400 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-10 h-10 border-r-4 border-t-4 border-green-400 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-l-4 border-b-4 border-green-400 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-r-4 border-b-4 border-green-400 rounded-br-lg" />
              <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-green-400/60 -translate-y-1/2 animate-pulse" />
            </div>
            <p className="text-white/70 text-sm mt-6 text-center px-8">
              Apunta al QR del fotocheck físico
            </p>
          </div>
        )}
      </div>

      {/* Input manual (fallback) */}
      <div className="bg-gray-900 px-4 pt-4 pb-2 flex-shrink-0">
        <p className="text-gray-400 text-xs text-center mb-3">O ingresa el código manualmente</p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={dniManual}
              onChange={e => setDniManual(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && enviarManual()}
              placeholder="RECOJO-XXXXXXXX-..."
              className="w-full pl-9 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 outline-none focus:border-green-500"
            />
          </div>
          <button
            onClick={enviarManual}
            disabled={!dniManual.trim() || cargando}
            className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium disabled:opacity-40"
          >
            OK
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="bg-gray-900 border-t border-white/5 flex flex-shrink-0">
        <button className="flex-1 flex flex-col items-center gap-1 py-3 text-green-400">
          <ScanLine className="w-5 h-5" />
          <span className="text-[10px] font-bold">Escanear</span>
        </button>
        <button
          onClick={irResumen}
          className="flex-1 flex flex-col items-center gap-1 py-3 text-gray-500"
        >
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Resumen</span>
        </button>
      </div>
    </div>
  )
}
