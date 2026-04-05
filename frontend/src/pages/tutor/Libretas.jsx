import { useState, useMemo } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen, Upload, Trash2, ExternalLink,
  CheckCircle2, Clock, Loader2, Bell, BellOff, Filter,
} from 'lucide-react'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'
import toast from 'react-hot-toast'

const BIMESTRES = [1, 2, 3, 4]

// ── Resumen visual de los 4 bimestres ─────────────────────────────────────────
function ResumenBimestres({ conteos, total, bimestreActivo, onCambiar }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {BIMESTRES.map(b => {
        const c       = conteos[b]
        const loading = c === null
        const pct     = total > 0 && !loading ? Math.round((c / total) * 100) : 0
        const completo = !loading && c === total && total > 0
        const activo   = bimestreActivo === b

        return (
          <button
            key={b}
            onClick={() => onCambiar(b)}
            className={`relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border-2 transition-all ${
              activo
                ? 'border-marino bg-marino text-white shadow-sm'
                : completo
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="text-xs font-bold">Bimestre {b}</span>

            {loading ? (
              <Loader2 size={12} className="animate-spin opacity-50" />
            ) : completo ? (
              <CheckCircle2 size={14} className={activo ? 'text-white' : 'text-green-500'} />
            ) : (
              <span className={`text-[11px] font-semibold ${activo ? 'text-white/80' : 'text-gray-400'}`}>
                {c}/{total}
              </span>
            )}

            {/* Barra mini */}
            {!loading && total > 0 && (
              <div className={`w-full h-1 rounded-full ${activo ? 'bg-white/30' : 'bg-gray-100'}`}>
                <div
                  className={`h-1 rounded-full transition-all ${
                    activo ? 'bg-white' : completo ? 'bg-green-400' : 'bg-marino/40'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Libretas() {
  const qc = useQueryClient()
  const anioActual = new Date().getFullYear()
  const [bimestre, setBimestre]       = useState(1)
  const [anio, setAnio]               = useState(anioActual)
  const [subiendoId, setSubiendoId]   = useState(null)
  const [notificar, setNotificar]     = useState(true)
  const [soloPendientes, setSoloPendientes] = useState(false)

  // Estudiantes del aula
  const { data: estudiantes = [] } = useQuery({
    queryKey: QK.tutorEstudiantes(),
    queryFn:  () => api.get('/tutor/mi-aula/estudiantes').then(r => r.data?.estudiantes || []),
  })

  // Libretas del bimestre activo
  const { data: libretas = [], isLoading } = useQuery({
    queryKey: QK.tutorLibretas(bimestre, anio),
    queryFn:  () => api.get('/tutor/libretas', { params: { bimestre, anio } }).then(r => r.data),
    staleTime: 30_000,
  })

  // Conteo de los 4 bimestres en paralelo para el resumen visual
  const resumenQueries = useQueries({
    queries: BIMESTRES.map(b => ({
      queryKey: QK.tutorLibretas(b, anio),
      queryFn:  () => api.get('/tutor/libretas', { params: { bimestre: b, anio } }).then(r => r.data),
      staleTime: 30_000,
    })),
  })
  const conteosPorBimestre = Object.fromEntries(
    BIMESTRES.map((b, i) => [
      b,
      resumenQueries[i].isLoading ? null : (resumenQueries[i].data?.length ?? 0),
    ])
  )

  const mapaLibretas = Object.fromEntries(libretas.map(l => [l.estudiante_id, l]))

  // Ordenar: pendientes primero. Filtrar si aplica.
  const estudiantesOrdenados = useMemo(() => {
    const sorted = [...estudiantes].sort((a, b) => {
      const aSubida = !!mapaLibretas[a.id]
      const bSubida = !!mapaLibretas[b.id]
      if (!aSubida && bSubida) return -1
      if (aSubida && !bSubida) return 1
      return 0
    })
    return soloPendientes ? sorted.filter(e => !mapaLibretas[e.id]) : sorted
  }, [estudiantes, mapaLibretas, soloPendientes])

  const subidas   = libretas.length
  const total     = estudiantes.length
  const pendientes = total - subidas

  const eliminar = useMutation({
    mutationFn: (id) => api.delete(`/tutor/libretas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK.tutorLibretas(bimestre, anio) })
      toast.success('Libreta eliminada')
    },
    onError: () => toast.error('Error al eliminar'),
  })

  const handleSubir = async (est, archivo) => {
    setSubiendoId(est.id)
    try {
      const form = new FormData()
      form.append('estudiante_id', est.id)
      form.append('bimestre', bimestre)
      form.append('anio', anio)
      form.append('notificar', notificar ? 'true' : 'false')
      form.append('archivo', archivo)
      await api.post('/tutor/libretas', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      qc.invalidateQueries({ queryKey: QK.tutorLibretas(bimestre, anio) })
      toast.success(
        notificar
          ? `Libreta de ${est.apellido} subida · apoderado notificado`
          : `Libreta de ${est.apellido} subida`
      )
    } catch {
      toast.error('Error al subir la libreta')
    } finally {
      setSubiendoId(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-marino">Libretas</h1>
          <p className="text-xs text-gray-400 mt-0.5">{anio}</p>
        </div>
        <select
          value={anio}
          onChange={e => setAnio(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 text-gray-700 bg-white focus:outline-none focus:border-marino"
        >
          {[anioActual - 1, anioActual, anioActual + 1].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      {/* 1 — Resumen visual 4 bimestres */}
      <ResumenBimestres
        conteos={conteosPorBimestre}
        total={total}
        bimestreActivo={bimestre}
        onCambiar={setBimestre}
      />

      {/* 2 — Barra de progreso + controles del bimestre activo */}
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">
            Bimestre {bimestre} · {subidas}/{total} subidas
          </span>
          <div className="flex items-center gap-2">
            {/* 2 — Filtro solo pendientes */}
            <button
              type="button"
              onClick={() => setSoloPendientes(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                soloPendientes
                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              <Filter size={11} />
              {soloPendientes ? `Pendientes (${pendientes})` : 'Solo pendientes'}
            </button>

            {/* 3 — Toggle notificar al apoderado */}
            <button
              type="button"
              onClick={() => setNotificar(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                notificar
                  ? 'bg-marino/10 text-marino border border-marino/20'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title={notificar ? 'Notificación activada: el apoderado recibirá un email al subir' : 'Sin notificación'}
            >
              {notificar ? <Bell size={11} /> : <BellOff size={11} />}
              {notificar ? 'Notificar' : 'Sin aviso'}
            </button>
          </div>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-marino h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${total > 0 ? Math.round((subidas / total) * 100) : 0}%` }}
          />
        </div>
      </div>

      {/* Lista de alumnos */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="text-marino animate-spin" />
          </div>
        ) : estudiantes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <BookOpen size={28} className="text-gray-200" />
            <p className="text-sm text-gray-400">Sin estudiantes en el aula</p>
          </div>
        ) : estudiantesOrdenados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <CheckCircle2 size={28} className="text-green-400" />
            <p className="text-sm font-semibold text-gray-600">¡Todo al día!</p>
            <p className="text-xs text-gray-400">Todos los alumnos tienen libreta en Bimestre {bimestre}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {estudiantesOrdenados.map(est => {
              const libreta  = mapaLibretas[est.id]
              const subiendo = subiendoId === est.id
              const initials = `${est.apellido?.[0] || ''}${est.nombre?.[0] || ''}`.toUpperCase()

              return (
                <div key={est.id} className="flex items-center gap-3 px-4 py-3">

                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                    libreta ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {libreta
                      ? <CheckCircle2 size={16} className="text-green-600" />
                      : initials
                    }
                  </div>

                  {/* Nombre + estado */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {est.apellido}, {est.nombre}
                    </p>
                    {libreta ? (
                      <p className="text-[11px] text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={10} />
                        Subida ·{' '}
                        {new Date(libreta.subido_en).toLocaleDateString('es-PE', {
                          day: 'numeric', month: 'short',
                        })}
                      </p>
                    ) : (
                      <p className="text-[11px] text-amber-500 flex items-center gap-1">
                        <Clock size={10} />
                        Pendiente
                      </p>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {libreta && (
                      <>
                        <a
                          href={libreta.archivo_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                          title="Ver libreta"
                        >
                          <ExternalLink size={13} className="text-gray-500" />
                        </a>
                        <button
                          type="button"
                          onClick={() => eliminar.mutate(libreta.id)}
                          disabled={eliminar.isPending}
                          className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
                          title="Eliminar libreta"
                        >
                          <Trash2 size={13} className="text-red-400" />
                        </button>
                      </>
                    )}

                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                      libreta
                        ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        : 'bg-marino text-white hover:bg-marino/90'
                    } ${subiendo ? 'opacity-50 pointer-events-none' : ''}`}>
                      {subiendo
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Upload size={12} />
                      }
                      {subiendo ? 'Subiendo…' : libreta ? 'Reemplazar' : 'Subir'}
                      <input
                        type="file"
                        className="sr-only"
                        accept="*/*"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) handleSubir(est, f)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
