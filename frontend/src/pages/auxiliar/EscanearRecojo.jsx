import { useState, useCallback, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'
import {
  ShieldCheck, ShieldX, Clock,
  CheckCircle2, AlertTriangle, UserX,
  ScanLine, BarChart2, RefreshCw, Users, Search, X,
} from 'lucide-react'
import toast from 'react-hot-toast'
import QRScanner from '../../components/QRScanner'
import api from '../../lib/api'
import { hapticMedium, hapticLight } from '../../lib/haptics'

const AUTO_CIERRE = 10

// ── Foto con inicial de fallback ──────────────────────────────────────────────
function Avatar({ foto_url, nombre, className = '', textClass = '', contain = false, imgStyle = {} }) {
  if (foto_url) {
    return (
      <img
        src={foto_url}
        alt={nombre}
        className={`${contain ? 'object-contain' : 'object-cover'} ${className}`}
        style={imgStyle}
      />
    )
  }
  return (
    <div className={`flex items-center justify-center font-black text-white/70 ${textClass} ${className}`}>
      {nombre?.charAt(0)?.toUpperCase() || '?'}
    </div>
  )
}

// ── Contador circular SVG ─────────────────────────────────────────────────────
function ContadorCircular({ segundos, total, color }) {
  const r    = 18
  const circ = 2 * Math.PI * r
  const dash = circ * (segundos / total)
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="rotate-[-90deg]">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
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

// ── PANTALLA RESULTADO — portal fullscreen nativo ─────────────────────────────
function PantallaResultado({ resultado, onCerrar }) {
  const [fase,    setFase]    = useState('viendo')
  const [cuenta,  setCuenta]  = useState(AUTO_CIERRE)
  const [pausado, setPausado] = useState(false)
  const timerRef = useRef(null)

  const {
    autorizado, estado, vencido,
    ya_recogido, recogido_a_las, recogido_por,
    alumno_presente, alumno_hora_ingreso,
    log_id, persona, estudiante,
  } = resultado

  useEffect(() => { hapticMedium() }, [])

  const ok        = autorizado
  const noAsistio = ok && !alumno_presente && !ya_recogido

  const conCuenta = (!autorizado || fase === 'exito' || noAsistio) && !pausado
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

  // Colores por estado
  const paleta = ya_recogido
    ? { bg: '#1e40af', bgLight: '#dbeafe', ring: '#60a5fa', badge: '#1d4ed8', text: '#1e3a8a' }
    : noAsistio
    ? { bg: '#c2410c', bgLight: '#ffedd5', ring: '#fb923c', badge: '#ea580c', text: '#7c2d12' }
    : ok
    ? { bg: '#15803d', bgLight: '#dcfce7', ring: '#4ade80', badge: '#16a34a', text: '#14532d' }
    : { bg: '#b91c1c', bgLight: '#fee2e2', ring: '#f87171', badge: '#dc2626', text: '#7f1d1d' }

  const motivoNoAuth = vencido
    ? 'Fotocheck vencido — no válido'
    : estado === 'revocado'
    ? 'Fotocheck revocado por el colegio'
    : estado === 'pendiente'
    ? 'Fotocheck pendiente de activación'
    : 'No figura como autorizado'

  const etiqueta = ya_recogido ? 'YA RECOGIDO'
    : noAsistio  ? 'ALUMNO AUSENTE'
    : ok         ? 'AUTORIZADO'
    : 'NO AUTORIZADO'

  const IconoEstado = ya_recogido ? CheckCircle2
    : noAsistio  ? UserX
    : ok         ? ShieldCheck
    : ShieldX

  // ── Render fullscreen como portal ────────────────────────────────────────
  const contenido = (
    <div
      className="fixed inset-0 z-[9999] flex flex-col animate-result-enter"
      style={{ background: paleta.bg }}
      onClick={() => setPausado(true)}
    >

      {/* ── Fase éxito ───────────────────────────────────────── */}
      {fase === 'exito' && (
        <div className="flex flex-col flex-1 items-center justify-center gap-5 px-6"
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="w-24 h-24 rounded-full bg-white/20 ring-4 ring-white/40 flex items-center justify-center">
            <CheckCircle2 className="w-14 h-14 text-white" />
          </div>
          <div className="text-center">
            <p className="text-white font-black text-3xl">Entrega confirmada</p>
            <p className="text-white/80 text-base mt-2">
              {persona?.nombre} {persona?.apellido}
            </p>
            <p className="text-white/60 text-sm mt-0.5">
              llevó a {estudiante?.nombre} {estudiante?.apellido}
            </p>
          </div>
          <button
            onClick={onCerrar}
            className="mt-4 w-full max-w-xs py-4 rounded-2xl font-black text-base bg-white/20 border border-white/30 text-white flex items-center justify-center gap-3"
          >
            <ScanLine className="w-5 h-5" />
            <span>Siguiente ({cuenta})</span>
            <ContadorCircular segundos={cuenta} total={AUTO_CIERRE} color="rgba(255,255,255,0.8)" />
          </button>
        </div>
      )}

      {/* ── Vista normal ─────────────────────────────────────── */}
      {fase !== 'exito' && (
        <>
          {/* Zona superior — foto grande */}
          <div className="relative flex-shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

            {/* Botón cerrar */}
            <button
              onClick={() => { setPausado(true); onCerrar() }}
              className="absolute z-10 w-10 h-10 rounded-full bg-black/30 flex items-center justify-center"
              style={{ top: 'calc(env(safe-area-inset-top) + 12px)', right: 16 }}
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Foto — object-contain para no recortar ni distorsionar retratos */}
            <div className="w-full bg-black flex items-center justify-center" style={{ maxHeight: '48vh', overflow: 'hidden' }}>
              <Avatar
                foto_url={persona?.foto_url}
                nombre={persona?.nombre}
                contain={true}
                className="w-full"
                textClass="text-9xl bg-gray-900 w-full"
                imgStyle={{ maxHeight: '48vh', width: '100%' }}
              />
            </div>

            {/* Gradiente sobre foto */}
            <div
              className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
              style={{ background: `linear-gradient(to top, ${paleta.bg} 0%, transparent 100%)` }}
            />

            {/* Badge estado */}
            <div
              className="absolute top-3 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-xl shadow-lg"
              style={{
                background: 'rgba(0,0,0,0.45)',
                top: `calc(env(safe-area-inset-top) + 12px)`,
              }}
            >
              <IconoEstado className="w-4 h-4 text-white" />
              <span className="text-white font-black text-xs tracking-wider">{etiqueta}</span>
            </div>

            {/* Nombre sobre foto */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 pointer-events-none">
              <p className="text-white font-black text-2xl leading-tight drop-shadow-lg">
                {persona?.nombre} {persona?.apellido}
              </p>
              <p className="text-white/75 text-sm mt-0.5 drop-shadow">
                {persona?.parentesco} · DNI {persona?.dni}
              </p>
            </div>
          </div>

          {/* Zona inferior — hoja blanca deslizable */}
          <div
            className="flex-1 bg-white rounded-t-3xl overflow-y-auto"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-4" />

            <div className="px-5 space-y-3 pb-4">

              {/* Ya recogido */}
              {ya_recogido && (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3">
                  <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-blue-100">
                    {recogido_por?.foto_snapshot
                      ? <img src={recogido_por.foto_snapshot} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center font-bold text-blue-400 text-base">
                          {recogido_por?.nombre?.charAt(0) || '?'}
                        </div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-blue-900 font-bold text-sm">
                      Recogido{recogido_a_las ? ` a las ${recogido_a_las}` : ''}
                    </p>
                    {recogido_por && (
                      <p className="text-blue-700 text-xs mt-0.5">
                        Por {recogido_por.nombre} {recogido_por.apellido}
                        <span className="text-blue-400"> · {recogido_por.parentesco}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Vigencia */}
              {ok && persona?.vigencia_hasta && (
                <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
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

              {/* No autorizado */}
              {!ok && !ya_recogido && !noAsistio && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-bold text-sm">{motivoNoAuth}</p>
                    <p className="text-red-600 text-xs mt-0.5">No entregar al alumno. Avisar a secretaría.</p>
                  </div>
                </div>
              )}

              {/* Alumno ausente */}
              {noAsistio && (
                <div className="flex flex-col items-center gap-3 bg-orange-50 border-2 border-orange-200 rounded-2xl px-4 py-5 text-center">
                  <UserX className="w-10 h-10 text-orange-500" />
                  <div>
                    <p className="text-orange-900 font-black text-base">Este alumno NO asistió hoy</p>
                    <p className="text-orange-700 text-xs mt-1 leading-relaxed">
                      No hay registro de ingreso. El recojo no puede ser autorizado.
                    </p>
                  </div>
                </div>
              )}

              <div className="h-px bg-gray-100" />

              {/* Alumno */}
              {estudiante && (
                <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gray-200">
                    <Avatar
                      foto_url={estudiante.foto_url}
                      nombre={estudiante.nombre}
                      className="w-full h-full"
                      textClass="text-2xl bg-gray-300 w-full h-full"
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
                    </p>
                    {alumno_hora_ingreso && (
                      <p className="text-xs text-green-600 font-medium mt-0.5">
                        Ingresó a las {alumno_hora_ingreso}
                      </p>
                    )}
                  </div>
                  {ya_recogido
                    ? <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    : ok
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                    : <UserX className="w-5 h-5 text-red-400 flex-shrink-0" />
                  }
                </div>
              )}

              {/* Botones acción */}
              <div className="pt-1 space-y-2">
                {ok && alumno_presente && !ya_recogido && (
                  <button
                    onClick={confirmarEntrega}
                    disabled={fase === 'confirmando'}
                    className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2.5 disabled:opacity-60"
                    style={{ background: paleta.bg }}
                  >
                    {fase === 'confirmando'
                      ? <><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Confirmando...</>
                      : <><ShieldCheck className="w-5 h-5" /> Confirmar entrega</>
                    }
                  </button>
                )}

                {/* Botón cerrar con cuenta regresiva */}
                {(!ok || ya_recogido || noAsistio) && (
                  <button
                    onClick={() => { setPausado(true); onCerrar() }}
                    className="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 bg-gray-100 text-gray-700 border border-gray-200"
                  >
                    {pausado
                      ? 'Cerrar'
                      : (
                        <>
                          <span>Cerrar ({cuenta})</span>
                          <ContadorCircular segundos={cuenta} total={AUTO_CIERRE} color="#6b7280" />
                        </>
                      )
                    }
                  </button>
                )}

                {/* Cancelar (cuando es autorizado y puede confirmar) */}
                {ok && alumno_presente && !ya_recogido && (
                  <button
                    onClick={() => { setPausado(true); onCerrar() }}
                    className="w-full py-3 rounded-2xl font-medium text-sm text-gray-400"
                  >
                    Cancelar
                  </button>
                )}
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )

  return ReactDOM.createPortal(contenido, document.body)
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
        <p className="text-sm font-bold text-gray-900 leading-tight truncate">{nombre} {apellido}</p>
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

function PanelResumen({ onVolver, pendientes }) {
  const [datos,    setDatos]    = useState(null)
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-marino">Resumen del día</h1>
          {datos && (
            <p className="text-xs text-gray-400 mt-0.5 capitalize">
              {new Date(datos.fecha + 'T00:00:00').toLocaleDateString('es-PE', { weekday: 'long', day: '2-digit', month: 'long' })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={cargar}
            disabled={cargando}
            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${cargando ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onVolver}
            className="flex items-center gap-2 px-3 py-2 bg-marino text-white text-sm font-semibold rounded-xl hover:brightness-110"
          >
            <ScanLine className="w-4 h-4" /> Escanear
          </button>
        </div>
      </div>

      {cargando && !datos && (
        <div className="flex gap-3">
          {[1,2,3].map(i => <div key={i} className="flex-1 h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      )}
      {datos && (
        <div className="flex gap-3">
          <StatCard valor={datos.total_presentes}  label="Presentes hoy"  color="marino" icon={Users}        />
          <StatCard valor={datos.total_recogidos}  label="Ya recogidos"    color="green"  icon={CheckCircle2} />
          <StatCard valor={datos.total_pendientes} label="Pendientes"      color="amber"  icon={Clock}        />
        </div>
      )}

      {datos && datos.pendientes.length > 0 && (
        <div className="card overflow-hidden p-0">
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
                key={i} {...p.estudiante}
                hora={p.hora_ingreso ? `Ingresó ${p.hora_ingreso}` : ''}
                badge="Esperando" badgeColor="bg-amber-100 text-amber-700"
              />
            ))}
          </div>
        </div>
      )}

      {datos && datos.recogidos.length > 0 && (
        <div className="card overflow-hidden p-0">
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
                <FilaEstudiante {...r.estudiante} hora={r.hora} badge="Recogido" badgeColor="bg-green-100 text-green-700" />
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

      {datos && datos.total_presentes === 0 && (
        <div className="card flex flex-col items-center justify-center py-12 text-gray-400">
          <Users className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">Sin ingresos registrados hoy</p>
        </div>
      )}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function EscanearRecojo() {
  const [modo,         setModo]         = useState('camara')
  const [cargando,     setCargando]     = useState(false)
  const [camaraActiva, setCamaraActiva] = useState(true)
  const [resultado,    setResultado]    = useState(null)
  const [dni,          setDni]          = useState('')
  const [pendientes,   setPendientes]   = useState(0)

  useEffect(() => {
    api.get('/recojo/resumen-hoy')
      .then(r => setPendientes(r.data?.total_pendientes ?? 0))
      .catch(() => {})
  }, [])

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

  const buscarPorDni = useCallback(async () => {
    const d = dni.trim()
    if (!d || d.length < 8) return
    if (cargando) return
    setCargando(true)
    setCamaraActiva(false)
    try {
      const { data } = await api.post('/recojo/buscar-dni', { dni: d })
      hapticLight()
      setResultado(data)
      setModo('resultado')
    } catch (err) {
      const msg = err.response?.data?.detail || 'DNI no encontrado'
      toast.error(msg)
      setCamaraActiva(true)
    } finally {
      setCargando(false)
      setDni('')
    }
  }, [dni, cargando])

  const cerrarResultado = useCallback(() => {
    setResultado(null)
    setModo('camara')
    setCamaraActiva(true)
    api.get('/recojo/resumen-hoy')
      .then(r => setPendientes(r.data?.total_pendientes ?? 0))
      .catch(() => {})
  }, [])

  // El portal se renderiza encima de todo incluso cuando modo='camara' (oculto mientras resultado=null)
  return (
    <>
      {/* ── Portal resultado fullscreen ─────────────────────────────────── */}
      {modo === 'resultado' && resultado && (
        <PantallaResultado resultado={resultado} onCerrar={cerrarResultado} />
      )}

      {/* ── Vista resumen ───────────────────────────────────────────────── */}
      {modo === 'resumen' && (
        <PanelResumen
          onVolver={() => { setModo('camara'); setCamaraActiva(true) }}
          pendientes={pendientes}
        />
      )}

      {/* ── Vista cámara ────────────────────────────────────────────────── */}
      {(modo === 'camara' || modo === 'resultado') && (
        <div className={`space-y-4 ${modo === 'resultado' ? 'invisible' : ''}`}>

          {/* Título */}
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-marino">Recojo Seguro</h1>
            <button
              onClick={() => { setModo('resumen'); setCamaraActiva(false) }}
              className="relative flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600"
            >
              <BarChart2 className="w-4 h-4" />
              <span>Resumen</span>
              {pendientes > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                  {pendientes}
                </span>
              )}
            </button>
          </div>

          {/* Scanner */}
          <div className="card">
            <p className="text-xs text-gray-400 text-center mb-3">
              Apunta al QR del fotocheck del responsable — el sistema verifica la autorización
            </p>
            <QRScanner activo={camaraActiva && !cargando} onResult={escanear} />
            {cargando && (
              <div className="flex items-center justify-center gap-2 mt-3 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-marino border-t-transparent rounded-full animate-spin" />
                Verificando autorización...
              </div>
            )}
          </div>

          {/* Buscar por DNI */}
          <div className="card">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              ¿QR no escanea? Busca por DNI
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={dni}
                  onChange={e => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  onKeyDown={e => e.key === 'Enter' && buscarPorDni()}
                  placeholder="DNI del responsable"
                  inputMode="numeric"
                  maxLength={8}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-marino focus:ring-1 focus:ring-marino"
                />
              </div>
              <button
                onClick={buscarPorDni}
                disabled={dni.length < 8 || cargando}
                className="px-4 py-2.5 bg-marino text-white rounded-xl text-sm font-bold disabled:opacity-40 flex items-center gap-1.5"
              >
                <Search className="w-4 h-4" />
                Buscar
              </button>
            </div>
          </div>

        </div>
      )}
    </>
  )
}
