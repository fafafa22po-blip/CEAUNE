import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import Layout from '../../components/Layout'
import api from '../../lib/api'

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
  const colors = {
    navy:   'bg-ceaune-navy text-white',
    green:  'bg-green-50 text-green-700 border border-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border border-yellow-100',
    red:    'bg-red-50 text-red-700 border border-red-100',
    teal:   'bg-teal-50 text-teal-700 border border-teal-100',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-2xl">{icon}</span>
        <span className="text-3xl font-bold tabular-nums">{value ?? '—'}</span>
      </div>
      <p className={`text-sm font-medium ${color === 'navy' ? 'text-blue-200' : 'opacity-80'}`}>{label}</p>
      {sub && <p className={`text-xs mt-0.5 ${color === 'navy' ? 'text-blue-300' : 'opacity-60'}`}>{sub}</p>}
    </div>
  )
}

// ─── Modal crear estudiante ───────────────────────────────────────────────────
function ModalCrear({ onClose, onCreado }) {
  const [alumno,    setAlumno]    = useState({ dni:'', nombre:'', apellido:'', grado:'1ro', seccion:'A' })
  const [apoderado, setApoderado] = useState({ dni:'', nombre:'', apellido:'', email:'' })
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [resultado, setResultado] = useState(null)

  const apoderadoTocado = apoderado.dni || apoderado.nombre || apoderado.apellido || apoderado.email

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (apoderadoTocado) {
      if (!apoderado.dni || !apoderado.nombre || !apoderado.apellido || !apoderado.email) {
        setError('Complete todos los datos del apoderado o déjelos en blanco.')
        return
      }
    }

    setLoading(true)
    try {
      const payload = {
        ...alumno,
        apoderado: apoderadoTocado ? apoderado : null,
      }
      const { data } = await api.post('/estudiantes/', payload)
      setResultado({ ...data, apoderadoDni: apoderado.dni })
      onCreado()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear estudiante')
    } finally { setLoading(false) }
  }

  // ── Pantalla de éxito ──────────────────────────────────────────────────────
  if (resultado) {
    const { estudiante, apoderado_creado, apoderado_existente, password_temporal } = resultado
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
          <div className="bg-green-600 text-white px-6 py-4 rounded-t-2xl">
            <h3 className="font-semibold">Registro completado</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎓</span>
              <div>
                <p className="font-semibold text-gray-800">{estudiante.nombre} {estudiante.apellido}</p>
                <p className="text-sm text-gray-500">{estudiante.grado} &apos;{estudiante.seccion}&apos; · DNI {estudiante.dni}</p>
              </div>
            </div>

            {apoderado_creado && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-blue-800">Cuenta de apoderado creada</p>
                <p className="text-xs text-blue-700">El apoderado puede ingresar al sistema con:</p>
                <div className="bg-white border border-blue-100 rounded-lg px-3 py-2 space-y-1">
                  <p className="text-xs text-gray-500">DNI: <span className="font-mono font-semibold text-gray-800">{resultado.apoderadoDni}</span></p>
                  <p className="text-xs text-gray-500">Contraseña: <span className="font-mono font-semibold text-gray-800">{password_temporal}</span></p>
                </div>
                <p className="text-xs text-blue-500">Comparta estas credenciales con el apoderado. Se recomienda cambiar la contraseña al primer ingreso.</p>
              </div>
            )}

            {apoderado_existente && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-sm text-yellow-800">El apoderado ya tenía una cuenta y fue vinculado al estudiante.</p>
              </div>
            )}

            {!apoderado_creado && !apoderado_existente && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-sm text-gray-600">No se registró apoderado. Puede agregarlo más adelante desde la gestión de estudiantes.</p>
              </div>
            )}

            <button onClick={onClose} className="w-full btn-gold py-2 text-sm">Cerrar</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulario ─────────────────────────────────────────────────────────────
  const inputClass = "w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-ceaune-gold text-sm"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">
        <div className="bg-ceaune-navy text-white px-6 py-4 rounded-t-2xl flex justify-between items-center shrink-0">
          <h3 className="font-semibold">Nuevo Estudiante</h3>
          <button onClick={onClose} className="text-blue-200 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">

          {/* ── Sección: Datos del Alumno ── */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Datos del Alumno</p>
            <div className="space-y-3">
              {[
                { name:'dni',      label:'DNI',      type:'text',  maxLength:8,   placeholder:'8 dígitos' },
                { name:'nombre',   label:'Nombre',   type:'text',  maxLength:100, placeholder:'Nombre(s)' },
                { name:'apellido', label:'Apellido', type:'text',  maxLength:100, placeholder:'Apellidos' },
              ].map(({ name, label, ...rest }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input {...rest} name={name} value={alumno[name]}
                    onChange={e => setAlumno({ ...alumno, [name]: e.target.value })}
                    required className={inputClass} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Grado</label>
                  <select value={alumno.grado} onChange={e => setAlumno({...alumno, grado: e.target.value})} className={inputClass}>
                    {['1ro','2do','3ro','4to','5to'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sección</label>
                  <select value={alumno.seccion} onChange={e => setAlumno({...alumno, seccion: e.target.value})} className={inputClass}>
                    {['A','B','C','D','E'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-200" />

          {/* ── Sección: Datos del Apoderado ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Datos del Apoderado</p>
              <span className="text-xs text-gray-300">(opcional)</span>
            </div>
            <div className="space-y-3">
              {[
                { name:'dni',      label:'DNI del apoderado',  type:'text',  maxLength:8,   placeholder:'8 dígitos' },
                { name:'nombre',   label:'Nombre',             type:'text',  maxLength:100, placeholder:'Nombre(s)' },
                { name:'apellido', label:'Apellido',           type:'text',  maxLength:100, placeholder:'Apellidos' },
                { name:'email',    label:'Correo electrónico', type:'email', maxLength:150, placeholder:'correo@ejemplo.com' },
              ].map(({ name, label, ...rest }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input {...rest} name={name} value={apoderado[name]}
                    onChange={e => setApoderado({ ...apoderado, [name]: e.target.value })}
                    className={inputClass} />
                </div>
              ))}
              <p className="text-xs text-gray-400 leading-relaxed">
                Si registra al apoderado, recibirá notificaciones automáticas por correo al registrar la asistencia del alumno.
                La contraseña inicial será su DNI.
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 btn-gold py-2 text-sm disabled:opacity-50">
              {loading ? 'Guardando...' : 'Crear estudiante'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal QR ─────────────────────────────────────────────────────────────────
function ModalQR({ estudiante, onClose }) {
  const [imgUrl, setImgUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const urlRef = useRef(null)

  useEffect(() => {
    api.get(`/estudiantes/${estudiante.id}/qr`, { responseType: 'blob' })
      .then(({ data }) => {
        const url = URL.createObjectURL(data)
        urlRef.current = url
        setImgUrl(url)
      })
      .catch(() => setError('No se pudo cargar el QR'))
      .finally(() => setLoading(false))
    return () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current) }
  }, [estudiante.id])

  const descargar = () => {
    if (!imgUrl) return
    const a = document.createElement('a')
    a.href = imgUrl
    a.download = `qr_${estudiante.dni}.png`
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="bg-ceaune-navy text-white px-6 py-4 rounded-t-2xl flex justify-between items-center">
          <div>
            <h3 className="font-semibold">Carnet QR</h3>
            <p className="text-blue-300 text-xs">{estudiante.nombre} {estudiante.apellido} · {estudiante.grado}'{estudiante.seccion}'</p>
          </div>
          <button onClick={onClose} className="text-blue-200 hover:text-white text-lg">✕</button>
        </div>
        <div className="p-6 flex flex-col items-center gap-4">
          {loading && (
            <div className="flex items-center justify-center h-48">
              <svg className="animate-spin h-8 w-8 text-ceaune-gold" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {imgUrl && (
            <img src={imgUrl} alt="QR" className="w-full rounded-xl border border-gray-100 shadow-sm" />
          )}
          {imgUrl && (
            <button onClick={descargar} className="btn-gold w-full py-2 text-sm">
              ⬇ Descargar PNG
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function Dashboard() {
  const [resumen,    setResumen]    = useState(null)
  const [semana,     setSemana]     = useState([])
  const [tardanzas,  setTardanzas]  = useState([])
  const [estudiantes,setEstudiantes]= useState([])
  const [loading,    setLoading]    = useState(true)
  const [showModal,  setShowModal]  = useState(false)
  const [qrEstudiante, setQrEstudiante] = useState(null)
  const [importando, setImportando] = useState(false)
  const [importMsg,  setImportMsg]  = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        api.get('/asistencia/hoy'),
        api.get('/asistencia/semana'),
        api.get('/asistencia/top-tardanzas'),
        api.get('/estudiantes/'),
      ])
      setResumen(r1.data)
      setSemana(r2.data)
      setTardanzas(r3.data)
      setEstudiantes(r4.data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true); setImportMsg(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const { data } = await api.post('/estudiantes/importar-excel', fd)
      setImportMsg({ ok: true, text: `Creados: ${data.creados} · Omitidos: ${data.omitidos} · Errores: ${data.errores}` })
      fetchAll()
    } catch (err) {
      setImportMsg({ ok: false, text: err.response?.data?.detail || 'Error al importar' })
    } finally { setImportando(false); e.target.value = '' }
  }

  const verQR = (e) => setQrEstudiante(e)

  const hoy = new Date().toLocaleDateString('es-PE', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  })

  const porcentajeAsistencia = resumen
    ? Math.round(((resumen.puntuales + resumen.tardanzas) / (resumen.total_estudiantes || 1)) * 100)
    : 0

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ceaune-navy">Dashboard Administrativo</h1>
            <p className="text-gray-400 text-sm capitalize mt-0.5">{hoy}</p>
          </div>
          <button onClick={fetchAll} className="btn-navy py-2 px-4 text-sm">↻ Actualizar</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Total alumnos"  value={resumen?.total_estudiantes} icon="👥" color="navy"
            sub={`${porcentajeAsistencia}% asistencia`} />
          <StatCard label="Puntuales"  value={resumen?.puntuales}  icon="✅" color="green"  />
          <StatCard label="Tardanzas"  value={resumen?.tardanzas}  icon="⚠️" color="yellow" />
          <StatCard label="Faltas"     value={resumen?.faltas}     icon="❌" color="red"    />
          <StatCard label="Con salida" value={resumen?.salieron}   icon="🏃" color="teal"   />
        </div>

        {/* Fila 2: Gráfico + Top tardanzas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">

          {/* Gráfico semana */}
          <div className="lg:col-span-7 card">
            <h2 className="font-semibold text-ceaune-navy mb-4">Asistencia — últimos 7 días</h2>
            {semana.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-400">Sin datos</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={semana} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="dia" tick={{ fontSize:12 }} />
                  <YAxis tick={{ fontSize:12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius:8, fontSize:12, border:'1px solid #e5e7eb' }}
                  />
                  <Legend wrapperStyle={{ fontSize:12 }} />
                  <Bar dataKey="puntuales" name="Puntuales" fill="#1a5c52" radius={[3,3,0,0]} />
                  <Bar dataKey="tardanzas" name="Tardanzas" fill="#c9a227" radius={[3,3,0,0]} />
                  <Bar dataKey="faltas"    name="Faltas"    fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top tardanzas */}
          <div className="lg:col-span-5 card">
            <h2 className="font-semibold text-ceaune-navy mb-4">Más tardanzas este mes</h2>
            {tardanzas.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-3xl mb-2">🎉</p>
                <p className="text-sm">Sin tardanzas registradas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tardanzas.slice(0, 5).map((t, i) => (
                  <div key={t.estudiante_id} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                      ${i === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {t.nombre} {t.apellido}
                      </p>
                      <p className="text-xs text-gray-400">{t.grado} '{t.seccion}'</p>
                    </div>
                    <span className="text-sm font-bold text-yellow-600 tabular-nums">
                      {t.tardanzas}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Fila 3: Gestión de estudiantes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-semibold text-ceaune-navy">
              Gestión de Estudiantes
              <span className="ml-2 text-sm font-normal text-gray-400">({estudiantes.length} activos)</span>
            </h2>
            <div className="flex gap-2 flex-wrap">
              {/* Importar Excel */}
              <label className={`btn-gold py-2 px-4 text-sm cursor-pointer ${importando ? 'opacity-60 pointer-events-none' : ''}`}>
                {importando ? '⏳ Importando...' : '📥 Importar Excel'}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
              </label>
              <button onClick={() => setShowModal(true)} className="btn-navy py-2 px-4 text-sm">
                + Nuevo alumno
              </button>
            </div>
          </div>

          {importMsg && (
            <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${importMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {importMsg.ok ? '✅' : '❌'} {importMsg.text}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <svg className="animate-spin h-6 w-6 text-ceaune-gold" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-100">
                    <th className="pb-2 px-2 text-gray-500 font-medium">DNI</th>
                    <th className="pb-2 px-2 text-gray-500 font-medium">Alumno</th>
                    <th className="pb-2 px-2 text-gray-500 font-medium">Grado</th>
                    <th className="pb-2 px-2 text-gray-500 font-medium text-center">QR</th>
                  </tr>
                </thead>
                <tbody>
                  {estudiantes.map((e, i) => (
                    <tr key={e.id} className={`border-t border-gray-50 hover:bg-gray-50 ${i%2===0?'':'bg-gray-50/40'}`}>
                      <td className="px-2 py-2.5 text-gray-500 tabular-nums">{e.dni}</td>
                      <td className="px-2 py-2.5 font-medium text-gray-800">{e.nombre} {e.apellido}</td>
                      <td className="px-2 py-2.5 text-gray-500">{e.grado} '{e.seccion}'</td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => verQR(e)}
                          className="text-ceaune-navy hover:text-ceaune-gold text-xs font-medium underline underline-offset-2"
                        >
                          Ver QR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {showModal && (
        <ModalCrear
          onClose={() => setShowModal(false)}
          onCreado={fetchAll}
        />
      )}
      {qrEstudiante && (
        <ModalQR estudiante={qrEstudiante} onClose={() => setQrEstudiante(null)} />
      )}
    </Layout>
  )
}
