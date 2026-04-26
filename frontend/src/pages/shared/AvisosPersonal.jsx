import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Bell, CheckCheck, Clock, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import { QK } from '../../lib/queryKeys'

export default function AvisosPersonal() {
  const qc = useQueryClient()

  const { data: avisos = [], isLoading } = useQuery({
    queryKey: QK.personalAvisos,
    queryFn:  () => api.get('/personal/avisos').then(r => r.data),
    staleTime: 30_000,
  })

  const { mutate: marcarLeido } = useMutation({
    mutationFn: (id) => api.put(`/personal/avisos/${id}/leer`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QK.personalAvisos })
      qc.invalidateQueries({ queryKey: QK.personalAvisosSinLeer })
    },
  })

  const { mutate: marcarTodos, isPending: marcandoTodos } = useMutation({
    mutationFn: () => api.put('/personal/avisos/todos-leidos'),
    onSuccess:  () => {
      toast.success('Todos marcados como leídos')
      qc.invalidateQueries({ queryKey: QK.personalAvisos })
      qc.invalidateQueries({ queryKey: QK.personalAvisosSinLeer })
    },
  })

  const sinLeer = avisos.filter(a => !a.leido).length

  if (isLoading) return (
    <div className="space-y-3">
      {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="space-y-4 max-w-2xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-marino">Avisos del Directivo</h1>
          {sinLeer > 0
            ? <p className="text-xs text-amber-600 font-semibold mt-0.5">{sinLeer} sin leer</p>
            : <p className="text-xs text-gray-400 mt-0.5">Al día con todos los avisos</p>
          }
        </div>
        {sinLeer > 0 && (
          <button
            onClick={() => marcarTodos()}
            disabled={marcandoTodos}
            className="flex items-center gap-1.5 text-xs font-semibold text-marino bg-marino/10 hover:bg-marino/15 px-3 py-1.5 rounded-xl transition-all active:scale-95">
            <CheckCheck size={13} />
            Marcar todos
          </button>
        )}
      </div>

      {/* Lista */}
      {avisos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center">
            <Bell size={36} className="text-gray-200" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-400">Sin avisos recibidos</p>
            <p className="text-xs text-gray-300 mt-0.5">Los avisos del directivo aparecerán aquí</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {avisos.map(aviso => (
            <button
              key={aviso.id}
              type="button"
              onClick={() => !aviso.leido && marcarLeido(aviso.id)}
              className={`w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99] ${
                aviso.leido
                  ? 'bg-white border border-gray-100 shadow-card'
                  : 'bg-marino/5 border border-marino/15 shadow-card'
              }`}>
              <div className="flex items-start gap-3">
                {/* Icono */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  aviso.leido ? 'bg-gray-100' : 'bg-marino/15'
                }`}>
                  {aviso.leido
                    ? <Bell size={15} className="text-gray-400" />
                    : <AlertCircle size={15} className="text-marino" />}
                </div>

                {/* Contenido */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className={`text-xs font-bold leading-tight ${aviso.leido ? 'text-gray-700' : 'text-marino'}`}>
                      {aviso.cargo_emisor}
                    </p>
                    {!aviso.leido && (
                      <span className="w-2 h-2 bg-marino rounded-full flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                  <p className={`text-sm leading-snug mb-2 ${aviso.leido ? 'text-gray-600' : 'text-gray-800 font-medium'}`}>
                    {aviso.mensaje}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                      <Clock size={10} />
                      {format(new Date(aviso.created_at), "d 'de' MMM, HH:mm", { locale: es })}
                    </div>
                    {aviso.leido && aviso.leido_at && (
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                        <CheckCheck size={10} />
                        Leído
                      </div>
                    )}
                    {!aviso.leido && (
                      <span className="text-[10px] font-semibold text-marino">Toca para marcar leído</span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
