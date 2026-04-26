import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, formatDistanceToNow, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, Calendar, Send, Eye,
  Search, CheckCircle, XCircle, Paperclip, Zap,
  FileCheck, MessageSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'

// ── CONSTANTES ────────────────────────────────────────────────────────────────
export const NIVEL_COLOR = {
  inicial:    'bg-emerald-100 text-emerald-700',
  primaria:   'bg-blue-100   text-blue-700',
  secundaria: 'bg-amber-100  text-amber-700',
}
export const NIVEL_LABEL = { inicial: 'Inicial', primaria: 'Primaria', secundaria: 'Secundaria' }
export const NIVEL_ICON  = { inicial: '🎒', primaria: '📖', secundaria: '🎓' }

export const AVISOS_RAPIDOS = [
  'Por favor registra tu actividad de hoy',
  'Tienes justificaciones pendientes',
  'Comunícate con dirección',
]

// ── HELPERS ───────────────────────────────────────────────────────────────────
export const getSemaforoAux = (a) =>
  a.escaneos_hoy === 0 ? 'rojo'
  : (a.primer_escaneo && a.primer_escaneo > '09:00') || a.justif_pendientes >= 3 ? 'ambar'
  : 'verde'

export const getSemaforoTutor = (t) =>
  t.comunicados_semana === 0 ? 'rojo'
  : t.comunicados_semana <= 1 ? 'ambar'
  : 'verde'

export const ini      = (n, a) => `${n?.[0] ?? ''}${a?.[0] ?? ''}`.toUpperCase()
export const relativo = (iso) => {
  try { return formatDistanceToNow(new Date(iso), { locale: es, addSuffix: true }) }
  catch { return '' }
}
export const ORDEN   = { rojo: 0, ambar: 1, verde: 2 }
export const HOY_STR = () => format(new Date(), 'yyyy-MM-dd')

// ── RING DE PROGRESO SVG ──────────────────────────────────────────────────────
export function RingProgress({ pct, color, size = 80 }) {
  const r    = (size - 12) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="currentColor" strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        className={`transition-all duration-700 ${color}`}
      />
    </svg>
  )
}

// ── DATE NAVIGATOR ────────────────────────────────────────────────────────────
export function DateNavigator({ fecha, onChange, compact = false, isFetching = false }) {
  const esHoy    = fecha === HOY_STR()
  const inputRef = useRef()
  const abrirPicker = () => {
    try { inputRef.current?.showPicker() }
    catch { inputRef.current?.click() }
  }
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {!compact && (
        <button onClick={() => onChange(format(addDays(parseISO(fecha), -7), 'yyyy-MM-dd'))}
          className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-all">
          <ChevronLeft size={13} className="text-gray-500" /><ChevronLeft size={13} className="-ml-2 text-gray-300" />
        </button>
      )}
      <button onClick={() => onChange(format(addDays(parseISO(fecha), -1), 'yyyy-MM-dd'))}
        className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-all">
        <ChevronLeft size={13} className="text-gray-600" />
      </button>
      <button type="button" onClick={abrirPicker}
        className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-xl px-3 py-1.5 transition-all select-none">
        {isFetching
          ? <span className="w-3 h-3 border-2 border-marino border-t-transparent rounded-full animate-spin flex-shrink-0" />
          : <Calendar size={12} className="text-marino flex-shrink-0" />}
        <span className="text-xs font-bold text-marino capitalize whitespace-nowrap">
          {esHoy ? 'Hoy' : format(parseISO(fecha), compact ? 'd MMM' : 'd MMM yyyy', { locale: es })}
        </span>
      </button>
      <input ref={inputRef} type="date" value={fecha} max={HOY_STR()}
        onChange={e => e.target.value && onChange(e.target.value)} className="sr-only" />
      <button onClick={() => onChange(format(addDays(parseISO(fecha), 1), 'yyyy-MM-dd'))}
        disabled={esHoy}
        className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-all disabled:opacity-30">
        <ChevronRight size={13} className="text-gray-600" />
      </button>
      {!compact && (
        <button onClick={() => onChange(format(addDays(parseISO(fecha), 7), 'yyyy-MM-dd'))}
          disabled={esHoy}
          className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 transition-all disabled:opacity-30">
          <ChevronRight size={13} className="text-gray-300" /><ChevronRight size={13} className="-ml-2 text-gray-500" />
        </button>
      )}
      {!esHoy && (
        <button onClick={() => onChange(HOY_STR())}
          className="text-[11px] font-bold text-white bg-marino px-2.5 py-1 rounded-xl active:scale-95 transition-all">
          Hoy
        </button>
      )}
    </div>
  )
}

// ── MINI BAR CHART (7 días) ───────────────────────────────────────────────────
export function MiniBarChart({ historial }) {
  if (!historial?.length) return null
  const max = Math.max(...historial.map(d => d.escaneos), 1)
  return (
    <div>
      <div className="flex items-end gap-1.5 h-16">
        {historial.map((d, i) => {
          const isToday = i === historial.length - 1
          const h = d.escaneos > 0 ? Math.max((d.escaneos / max) * 64, 6) : 4
          return (
            <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-[9px] font-bold ${d.escaneos > 0 ? (isToday ? 'text-dorado' : 'text-gray-400') : 'text-transparent'}`}>
                {d.escaneos}
              </span>
              <div className="w-full flex items-end" style={{ height: 48 }}>
                <div
                  className={`w-full rounded-t-md transition-all ${isToday ? 'bg-dorado' : d.escaneos > 0 ? 'bg-marino/60' : 'bg-gray-200'}`}
                  style={{ height: h }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1.5 mt-2">
        {historial.map((d, i) => {
          const isToday = i === historial.length - 1
          const letra = format(parseISO(d.fecha), 'EEEEEE', { locale: es }).toUpperCase()
          return (
            <div key={d.fecha} className="flex-1 text-center">
              <span className={`text-[9px] font-bold ${isToday ? 'text-dorado' : 'text-gray-400'}`}>{letra}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── BAR CHART COMUNICADOS (Lun–Vie) ──────────────────────────────────────────
export function BarChartSemana({ porDia }) {
  if (!porDia?.length) return null
  const max  = Math.max(...porDia.map(d => d.total), 1)
  const DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi']
  return (
    <div>
      <div className="flex items-end gap-2 h-16">
        {porDia.map((d) => {
          const h = d.total > 0 ? Math.max((d.total / max) * 64, 6) : 4
          return (
            <div key={d.fecha} className="flex-1 flex flex-col items-center gap-1">
              <span className={`text-[10px] font-bold ${d.total > 0 ? 'text-dorado' : 'text-transparent'}`}>{d.total}</span>
              <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                <div className={`w-full rounded-t-md ${d.total > 0 ? 'bg-dorado/80' : 'bg-gray-200'}`} style={{ height: h }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 mt-2">
        {DIAS.map((dia) => (
          <div key={dia} className="flex-1 text-center">
            <span className="text-[10px] text-gray-400 font-medium">{dia}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PAGINACIÓN ────────────────────────────────────────────────────────────────
export function Paginacion({ pagina, totalPaginas, onAnterior, onSiguiente }) {
  if (totalPaginas <= 1) return null
  return (
    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
      <button disabled={pagina <= 1} onClick={onAnterior}
        className="flex items-center gap-1 text-sm font-semibold text-marino disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">
        <ChevronLeft size={15} /> Anterior
      </button>
      <span className="text-sm text-gray-400 font-medium">{pagina} de {totalPaginas}</span>
      <button disabled={pagina >= totalPaginas} onClick={onSiguiente}
        className="flex items-center gap-1 text-sm font-semibold text-marino disabled:opacity-30 disabled:cursor-not-allowed active:scale-95">
        Siguiente <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ── AVISO RÁPIDO ──────────────────────────────────────────────────────────────
export function AvisoRapido({ personaId, avisosPrevios = [] }) {
  const [texto,        setTexto]        = useState('')
  const [verHistorial, setVerHistorial] = useState(false)
  const qc = useQueryClient()

  const { mutate: enviar, isPending } = useMutation({
    mutationFn: () => api.post(`/directivo/avisar/${personaId}`, { mensaje: texto.trim() }),
    onSuccess: () => {
      toast.success('Aviso enviado')
      setTexto('')
      qc.invalidateQueries({ queryKey: ['directivo', 'aux-detalle'] })
      qc.invalidateQueries({ queryKey: ['directivo', 'tutor-detalle'] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error al enviar'),
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-marino" />
          <p className="text-xs font-black text-gray-500 uppercase tracking-wider">Enviar aviso directo</p>
        </div>
        {avisosPrevios.length > 0 && (
          <button onClick={() => setVerHistorial(!verHistorial)}
            className="text-[11px] font-semibold text-marino hover:underline">
            {verHistorial ? 'Ocultar' : `Historial (${avisosPrevios.length})`}
          </button>
        )}
      </div>

      {verHistorial && avisosPrevios.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {avisosPrevios.map(av => (
            <div key={av.id} className={`rounded-xl px-3 py-2.5 ${av.leido ? 'bg-gray-50' : 'bg-marino/5 border border-marino/10'}`}>
              <p className="text-sm text-gray-700 leading-snug">{av.mensaje}</p>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] text-gray-400">{relativo(av.created_at)}</span>
                <span className={`text-[10px] font-bold ${av.leido ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {av.leido ? '✓ Leído' : 'Sin leer'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {AVISOS_RAPIDOS.map(msg => (
          <button key={msg} type="button" onClick={() => setTexto(msg)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              texto === msg ? 'bg-marino text-white border-marino' : 'bg-white text-gray-600 border-gray-200 hover:border-marino/40'
            }`}>
            {msg}
          </button>
        ))}
      </div>

      <textarea className="input text-sm resize-none" rows={3}
        placeholder="O escribe un aviso personalizado..."
        value={texto} onChange={e => setTexto(e.target.value.slice(0, 300))} />

      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400">{texto.length}/300</span>
        <button type="button" disabled={texto.trim().length < 5 || isPending}
          onClick={() => enviar()} className="btn-primary px-5 py-2">
          {isPending
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando...</>
            : <><Send size={14} /> Enviar</>}
        </button>
      </div>
    </div>
  )
}

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

// ── TAB: COMUNICADOS ──────────────────────────────────────────────────────────
export function TabComunicados({ personaId }) {
  const [pagina,   setPagina]   = useState(1)
  const [q,        setQ]        = useState('')
  const [busqueda, setBusqueda] = useState('')
  // modo: 'todo' | 'dia' | 'mes'
  const [modo,     setModo]     = useState('todo')
  const [fechaDia, setFechaDia] = useState(HOY_STR)
  const [mesVal,   setMesVal]   = useState(() => new Date().getMonth() + 1)
  const [anioVal,  setAnioVal]  = useState(() => new Date().getFullYear())
  const diaRef = useRef()

  // filtro serializado para queryKey + params
  const filtro = modo === 'dia'
    ? { fecha_exacta: fechaDia }
    : modo === 'mes'
    ? { mes: mesVal, anio: anioVal }
    : {}

  useEffect(() => { setPagina(1) }, [busqueda, modo, fechaDia, mesVal, anioVal])

  const { data, isLoading } = useQuery({
    queryKey: QK.directivoComunicados(personaId, pagina, busqueda, filtro),
    queryFn:  () => api.get(`/directivo/supervision/personal/${personaId}/comunicados`, {
      params: { pagina, por_pagina: 10, q: busqueda, ...filtro },
    }).then(r => r.data),
    staleTime: 30_000,
    keepPreviousData: true,
  })

  const items        = data?.items ?? []
  const total        = data?.total ?? 0
  const totalPaginas = data?.total_paginas ?? 1

  return (
    <div className="space-y-4">
      {/* Filtro fecha */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Modo selector */}
        <div className="flex gap-1">
          {[
            { key: 'todo', label: 'Todo' },
            { key: 'dia',  label: 'Por día' },
            { key: 'mes',  label: 'Por mes' },
          ].map(m => (
            <button key={m.key} onClick={() => setModo(m.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                modo === m.key
                  ? 'bg-marino text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Selector de día */}
        {modo === 'dia' && (
          <div className="flex items-center gap-1.5">
            <button onClick={() => {
              const d = new Date(fechaDia + 'T12:00:00')
              d.setDate(d.getDate() - 1)
              setFechaDia(format(d, 'yyyy-MM-dd'))
            }} className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95">
              <ChevronLeft size={13} className="text-gray-600" />
            </button>
            <button type="button" onClick={() => { try { diaRef.current?.showPicker() } catch { diaRef.current?.click() } }}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 rounded-xl px-3 py-1.5 transition-all">
              <Calendar size={12} className="text-marino" />
              <span className="text-xs font-bold text-marino">
                {fechaDia === HOY_STR() ? 'Hoy' : format(parseISO(fechaDia), "d 'de' MMMM yyyy", { locale: es })}
              </span>
            </button>
            <input ref={diaRef} type="date" value={fechaDia} max={HOY_STR()}
              onChange={e => e.target.value && setFechaDia(e.target.value)} className="sr-only" />
            <button onClick={() => {
              if (fechaDia >= HOY_STR()) return
              const d = new Date(fechaDia + 'T12:00:00')
              d.setDate(d.getDate() + 1)
              setFechaDia(format(d, 'yyyy-MM-dd'))
            }} disabled={fechaDia >= HOY_STR()}
              className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center active:scale-95 disabled:opacity-30">
              <ChevronRight size={13} className="text-gray-600" />
            </button>
          </div>
        )}

        {/* Selector de mes + año */}
        {modo === 'mes' && (
          <div className="flex items-center gap-2">
            <select value={mesVal} onChange={e => setMesVal(Number(e.target.value))}
              className="input py-1.5 text-xs font-semibold pr-8 cursor-pointer">
              {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <select value={anioVal} onChange={e => setAnioVal(Number(e.target.value))}
              className="input py-1.5 text-xs font-semibold pr-8 w-24 cursor-pointer">
              {Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Buscador */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 py-2.5 text-sm" placeholder="Buscar por asunto..."
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setBusqueda(q)} />
        </div>
        <button onClick={() => setBusqueda(q)} className="btn-secondary px-4 text-sm">Buscar</button>
      </div>

      {total > 0 && (
        <p className="text-xs text-gray-400 font-medium">{total} comunicado{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
      )}

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <MessageSquare size={40} className="text-gray-200" />
          <p className="text-sm text-gray-400">Sin comunicados{busqueda ? ' para esa búsqueda' : ''}</p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map(c => (
            <div key={c.id} className="bg-gray-50 rounded-2xl px-4 py-4 border border-gray-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-bold text-gray-800 leading-tight flex-1">{c.asunto}</p>
                <span className="text-[10px] text-gray-400 flex-shrink-0 tabular-nums">
                  {format(new Date(c.created_at), "d MMM, HH:mm", { locale: es })}
                </span>
              </div>
              {c.mensaje && <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">{c.mensaje}</p>}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1.5">
                  <Eye size={12} className="text-emerald-500" />
                  <span className="text-sm font-black text-emerald-600">{c.pct}%</span>
                  <span className="text-xs text-gray-400">leído</span>
                </div>
                <span className="text-xs text-gray-400">· {c.total} familias</span>
              </div>
              {c.total > 0 && (
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${c.pct}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Paginacion pagina={pagina} totalPaginas={totalPaginas}
        onAnterior={() => setPagina(p => p - 1)}
        onSiguiente={() => setPagina(p => p + 1)} />
    </div>
  )
}

// ── TAB: JUSTIFICACIONES ──────────────────────────────────────────────────────
const ESTADOS_JUST = [
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'aprobada',  label: 'Aprobadas'  },
  { key: 'rechazada', label: 'Rechazadas' },
]

export function TabJustificaciones({ nivel }) {
  const qc = useQueryClient()
  const [pagina,     setPagina]     = useState(1)
  const [estado,     setEstado]     = useState('pendiente')
  const [rechazando, setRechazando] = useState(null)

  useEffect(() => { setPagina(1) }, [estado])

  const { data, isLoading } = useQuery({
    queryKey: QK.directivoJustificaciones(nivel, estado, pagina),
    queryFn:  () => api.get('/directivo/supervision/justificaciones', {
      params: { nivel, estado, pagina, por_pagina: 10 },
    }).then(r => r.data),
    staleTime: 30_000,
    keepPreviousData: true,
    enabled: !!nivel,
  })

  const invalida = () => {
    qc.invalidateQueries({ queryKey: ['directivo', 'justificaciones'] })
    qc.invalidateQueries({ queryKey: QK.directivoSupervision })
    qc.invalidateQueries({ queryKey: ['directivo', 'aux-detalle'] })
  }

  const { mutate: aprobar, isPending: aprobando } = useMutation({
    mutationFn: (id) => api.put(`/justificaciones/${id}/aprobar`),
    onSuccess: () => { toast.success('Justificación aprobada'); invalida() },
    onError:   (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const { mutate: rechazar, isPending: rechazandoApi } = useMutation({
    mutationFn: ({ id, motivo }) => api.put(`/justificaciones/${id}/rechazar`, { observacion: motivo }),
    onSuccess: () => { toast.success('Justificación rechazada'); setRechazando(null); invalida() },
    onError:   (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const items        = data?.items ?? []
  const total        = data?.total ?? 0
  const totalPaginas = data?.total_paginas ?? 1

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {ESTADOS_JUST.map(e => (
          <button key={e.key} onClick={() => setEstado(e.key)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              estado === e.key ? 'bg-marino text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}>
            {e.label}
          </button>
        ))}
      </div>

      {total > 0 && (
        <p className="text-xs text-gray-400 font-medium">{total} justificación{total !== 1 ? 'es' : ''}</p>
      )}

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <FileCheck size={40} className="text-gray-200" />
          <p className="text-sm text-gray-400">
            {estado === 'pendiente' ? '¡Todo al día! Sin pendientes' : `Sin justificaciones ${estado === 'aprobada' ? 'aprobadas' : 'rechazadas'}`}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map(j => (
            <div key={j.id} className={`rounded-2xl border px-4 py-4 ${
              j.estado === 'pendiente' ? 'bg-amber-50/60 border-amber-100'
              : j.estado === 'aprobada' ? 'bg-emerald-50/60 border-emerald-100'
              : 'bg-red-50/60 border-red-100'
            }`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-gray-900 truncate">{j.estudiante}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{j.grado}° {j.seccion} · {format(parseISO(j.fecha), "d MMM yyyy", { locale: es })}</p>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                  j.estado === 'pendiente' ? 'bg-amber-100 text-amber-700'
                  : j.estado === 'aprobada' ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-600'
                }`}>
                  {j.estado}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-3 leading-relaxed">{j.motivo}</p>
              {j.adjunto_nombre && (
                <a href={j.adjunto_drive_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mb-3 text-xs text-marino font-semibold hover:underline">
                  <Paperclip size={12} /> {j.adjunto_nombre}
                </a>
              )}
              {j.estado === 'pendiente' && (
                rechazando?.id === j.id ? (
                  <div className="space-y-2">
                    <textarea className="input text-sm resize-none py-2" rows={2}
                      placeholder="Motivo de rechazo (requerido)"
                      value={rechazando.motivo}
                      onChange={e => setRechazando(r => ({ ...r, motivo: e.target.value }))}
                      autoFocus />
                    <div className="flex gap-2">
                      <button onClick={() => setRechazando(null)} className="btn-secondary flex-1 py-2 text-sm">Cancelar</button>
                      <button disabled={rechazando.motivo.trim().length < 3 || rechazandoApi}
                        onClick={() => rechazar({ id: j.id, motivo: rechazando.motivo.trim() })}
                        className="btn-danger flex-1 py-2 text-sm">
                        {rechazandoApi ? 'Rechazando...' : 'Confirmar'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button disabled={aprobando} onClick={() => aprobar(j.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500 text-white text-sm font-bold active:scale-95 transition-all disabled:opacity-50">
                      <CheckCircle size={14} /> Aprobar
                    </button>
                    <button onClick={() => setRechazando({ id: j.id, motivo: '' })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-100 text-red-600 text-sm font-bold active:scale-95 transition-all">
                      <XCircle size={14} /> Rechazar
                    </button>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )}

      <Paginacion pagina={pagina} totalPaginas={totalPaginas}
        onAnterior={() => setPagina(p => p - 1)}
        onSiguiente={() => setPagina(p => p + 1)} />
    </div>
  )
}
