import { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { QK } from '../lib/queryKeys'
import { obtenerUsuario } from '../lib/auth'

const HijoCtx = createContext(null)

export function HijoProvider({ children }) {
  const usuario     = obtenerUsuario()
  const esApoderado =
    usuario?.rol === 'apoderado' ||
    (usuario?.es_apoderado === true && localStorage.getItem('modo_sesion') === 'apoderado')

  const { data: hijos = [], isLoading: cargando } = useQuery({
    queryKey: QK.misHijos,
    queryFn:  () => api.get('/apoderado/mis-hijos').then(r => r.data || []),
    enabled:   esApoderado,
    staleTime: 5 * 60_000,
  })

  // Persiste el ID del hijo activo entre navegaciones y recargas
  const [hijoActivoId, setHijoActivoId] = useState(
    () => localStorage.getItem('ceaune_hijo_activo') || null
  )

  // Auto-seleccionar el primero cuando cargan los hijos
  useEffect(() => {
    if (hijos.length > 0 && !hijoActivoId) {
      const id = hijos[0].id
      setHijoActivoId(id)
      localStorage.setItem('ceaune_hijo_activo', id)
    }
  }, [hijos, hijoActivoId])

  // Si el ID guardado ya no existe (hijo eliminado), caer al primero
  const hijoActivo =
    hijos.find(h => h.id === hijoActivoId) ?? hijos[0] ?? null

  const seleccionar = (id) => {
    setHijoActivoId(id)
    localStorage.setItem('ceaune_hijo_activo', id)
  }

  return (
    <HijoCtx.Provider value={{ hijos, hijoActivo, seleccionar, cargando }}>
      {children}
    </HijoCtx.Provider>
  )
}

export function useHijo() {
  const ctx = useContext(HijoCtx)
  if (!ctx) throw new Error('useHijo debe usarse dentro de HijoProvider')
  return ctx
}
