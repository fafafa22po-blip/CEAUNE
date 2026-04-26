import { useState, useEffect } from 'react'
import { MessageSquare } from 'lucide-react'
import api from '../../lib/api'
import Comunicar from './Comunicar'
import Bandeja from './Bandeja'

export default function AuxiliarComunicados() {
  const [tab,        setTab]        = useState('nuevo')
  const [bandejaKey, setBandejaKey] = useState(0)
  const [sinLeer,    setSinLeer]    = useState(0)

  useEffect(() => {
    api.get('/comunicados/respuestas', { params: { por_pagina: 1 } })
      .then(r => setSinLeer(r.data.no_leidas ?? 0))
      .catch(() => {})
  }, [])

  const irABandeja = () => {
    setBandejaKey(k => k + 1)
    setTab('bandeja')
    setSinLeer(0)
  }

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 7rem)' }}
    >
      {/* Cabecera + tabs */}
      <div className="flex-shrink-0 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-marino flex items-center justify-center flex-shrink-0">
            <MessageSquare size={17} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-marino">Comunicados</h1>
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { id: 'nuevo',   label: 'Nuevo comunicado' },
            { id: 'bandeja', label: 'Bandeja'           },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-white text-marino shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
              {id === 'bandeja' && sinLeer > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-0.5 bg-blue-500 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                  {sinLeer > 9 ? '9+' : sinLeer}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      {tab === 'nuevo' && (
        <div className="flex-1 overflow-y-auto">
          <Comunicar onEnviado={irABandeja} />
        </div>
      )}
      {tab === 'bandeja' && (
        <Bandeja key={bandejaKey} inTab />
      )}
    </div>
  )
}
