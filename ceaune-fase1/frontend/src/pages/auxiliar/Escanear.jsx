import { useState, useEffect, useRef, useCallback } from 'react'
import Layout from '../../components/Layout'
import QRScanner from '../../components/QRScanner'
import api from '../../lib/api'

// ─── Badge de estado ──────────────────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const cfg = {
    puntual:  { cls: 'bg-green-100 text-green-800',  icon: '✅', label: 'Puntual'  },
    tardanza: { cls: 'bg-yellow-100 text-yellow-800', icon: '⚠️', label: 'Tardanza' },
    falta:    { cls: 'bg-red-100 text-red-800',       icon: '❌', label: 'Falta'    },
    especial: { cls: 'bg-blue-100 text-blue-800',     icon: '🔵', label: 'Especial' },
  }
  const { cls, icon, label } = cfg[estado] || cfg.especial
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${cls}`}>
      {icon} {label}
    </span>
  )
}

// ─── Tipo badge ───────────────────────────────────────────────────────────────
function TipoBadge({ tipo }) {
  const esIngreso = tipo.includes('ingreso')
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
      esIngreso ? 'bg-ceaune-navy/10 text-ceaune-navy' : 'bg-ceaune-teal/10 text-ceaune-teal'
    }`}>
      {esIngreso ? '↗ Entrada' : '↙ Salida'}
    </span>
  )
}

// ─── Reloj en tiempo real ─────────────────────────────────────────────────────
function Reloj() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="text-right">
      <p className="text-2xl font-bold text-ceaune-navy tabular-nums">
        {time.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </p>
      <p className="text-xs text-gray-400 capitalize">
        {time.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
    </div>
  )
}

// ─── Card resultado del escaneo ───────────────────────────────────────────────
function ResultCard({ result, onClear }) {
  useEffect(() => {
    const id = setTimeout(onClear, 8000)
    return () => clearTimeout(id)
  }, [result, onClear])

  const isError = !!result.error
  return (
    <div className={`rounded-xl border-2 p-4 transition-all animate-in fade-in duration-300 ${
      isError
        ? 'border-red-200 bg-red-50'
        : result.estado === 'tardanza'
          ? 'border-yellow-200 bg-yellow-50'
          : result.estado === 'puntual'
            ? 'border-green-200 bg-green-50'
            : 'border-blue-200 bg-blue-50'
    }`}>
      {isError ? (
        <div className="flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-700">Error</p>
            <p className="text-sm text-red-600">{result.error}</p>
          </div>
          <button onClick={onClear} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-full bg-ceaune-navy flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            {result.estudiante_nombre?.[0]}{result.estudiante_apellido?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 truncate">
              {result.estudiante_nombre} {result.estudiante_apellido}
            </p>
            <p className="text-sm text-gray-500">
              {result.estudiante_grado} '{result.estudiante_seccion}' · Secundaria
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <EstadoBadge estado={result.estado} />
              <TipoBadge tipo={result.tipo} />
              <span className="text-xs text-gray-400">
                {new Date(result.hora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {result.observacion && (
              <p className="text-xs text-gray-500 mt-1 italic">{result.observacion}</p>
            )}
          </div>
          <button onClick={onClear} className="text-gray-300 hover:text-gray-500 flex-shrink-0">✕</button>
        </div>
      )}
    </div>
  )
}

// ─── Fila del feed ────────────────────────────────────────────────────────────
function FeedRow({ r }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-ceaune-navy/10 flex items-center justify-center text-ceaune-navy text-xs font-bold flex-shrink-0">
        {r.estudiante_nombre?.[0]}{r.estudiante_apellido?.[0]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {r.estudiante_nombre} {r.estudiante_apellido}
        </p>
        <p className="text-xs text-gray-400">{r.estudiante_grado}'{r.estudiante_seccion}'</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <EstadoBadge estado={r.estado} />
        <span className="text-xs text-gray-400">
          {new Date(r.hora).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Escanear() {
  const [tab, setTab]           = useState('camera')   // 'camera' | 'dni'
  const [tipo, setTipo]         = useState('ingreso')  // 'ingreso' | 'salida'
  const [dni, setDni]           = useState('')
  const [observacion, setObs]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [feed, setFeed]         = useState([])
  const [loadingFeed, setLoadingFeed] = useState(true)
  const procesando = useRef(false)

  // Cargar feed inicial
  const fetchFeed = useCallback(async () => {
    try {
      const { data } = await api.get('/asistencia/hoy/lista')
      setFeed(data.slice(0, 20))
    } catch { /* silencioso */ }
    finally { setLoadingFeed(false) }
  }, [])

  useEffect(() => { fetchFeed() }, [fetchFeed])

  // Registrar asistencia (común para QR y DNI)
  const registrar = useCallback(async ({ qr_token, dni: dniVal }) => {
    if (procesando.current) return
    procesando.current = true
    setLoading(true)
    try {
      const payload = { tipo, observacion: observacion || undefined }
      if (qr_token) payload.qr_token = qr_token
      else payload.dni = dniVal

      const { data } = await api.post('/asistencia/escanear', payload)
      setResult(data)
      setDni('')
      setObs('')
      fetchFeed()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al registrar asistencia'
      setResult({ error: msg })
    } finally {
      setLoading(false)
      setTimeout(() => { procesando.current = false }, 2500)
    }
  }, [tipo, observacion, fetchFeed])

  const handleQR   = useCallback((token) => registrar({ qr_token: token }), [registrar])
  const handleDNI  = (e) => {
    e.preventDefault()
    if (dni.trim().length < 3) return
    registrar({ dni: dni.trim() })
  }

  const needsObs = tipo === 'salida'

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">

        {/* Header con reloj */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ceaune-navy">Registro de Asistencia</h1>
            <p className="text-gray-400 text-sm mt-0.5">Secundaria CEAUNE</p>
          </div>
          <Reloj />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ── Columna izquierda: Scanner ── */}
          <div className="lg:col-span-7 space-y-4">

            {/* Selector INGRESO / SALIDA */}
            <div className="card p-2">
              <div className="grid grid-cols-2 gap-1">
                {['ingreso', 'salida'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={`py-3 rounded-lg font-semibold text-sm transition-all capitalize ${
                      tipo === t
                        ? t === 'ingreso'
                          ? 'bg-ceaune-navy text-white shadow-sm'
                          : 'bg-ceaune-teal text-white shadow-sm'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    {t === 'ingreso' ? '↗ Ingreso' : '↙ Salida'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tabs Cámara / DNI */}
            <div className="card p-0 overflow-hidden">
              {/* Tab headers */}
              <div className="flex border-b border-gray-100">
                {[
                  { id: 'camera', label: '📷 Cámara QR' },
                  { id: 'dni',    label: '🔢 DNI Manual' },
                ].map(({ id, label }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      tab === id
                        ? 'text-ceaune-navy border-b-2 border-ceaune-gold bg-amber-50/50'
                        : 'text-gray-400 hover:text-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-4">
                {/* Panel cámara */}
                {tab === 'camera' && (
                  <div className="space-y-3">
                    <QRScanner onResult={handleQR} active={tab === 'camera' && !loading} />
                    <p className="text-xs text-center text-gray-400">
                      Apunta la cámara al código QR del alumno
                    </p>
                  </div>
                )}

                {/* Panel DNI manual */}
                {tab === 'dni' && (
                  <form onSubmit={handleDNI} className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        DNI del alumno
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={dni}
                          onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 8))}
                          placeholder="Ej: 10000001"
                          maxLength={8}
                          autoFocus
                          className="flex-1 px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ceaune-gold text-gray-800 text-lg tracking-widest"
                        />
                        <button
                          type="submit"
                          disabled={loading || dni.length < 3}
                          className="btn-navy px-6 disabled:opacity-50"
                        >
                          {loading ? (
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                          ) : 'Registrar'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* Observación */}
            <div className="card">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Observación {needsObs ? '(recomendado para salida)' : '(opcional)'}
              </label>
              <textarea
                value={observacion}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Ej: Permiso médico, actividad extracurricular..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ceaune-gold text-sm text-gray-700 resize-none"
              />
            </div>

            {/* Resultado del último escaneo */}
            {result && (
              <ResultCard result={result} onClear={() => setResult(null)} />
            )}
          </div>

          {/* ── Columna derecha: Feed del día ── */}
          <div className="lg:col-span-5">
            <div className="card h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-ceaune-navy">Últimos registros de hoy</h2>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {feed.length}
                </span>
              </div>

              {loadingFeed ? (
                <div className="flex items-center justify-center py-12">
                  <svg className="animate-spin h-6 w-6 text-ceaune-gold" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                </div>
              ) : feed.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-4xl mb-2">📭</p>
                  <p className="text-sm">Sin registros aún hoy</p>
                </div>
              ) : (
                <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
                  {feed.map((r) => <FeedRow key={r.id} r={r} />)}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  )
}
