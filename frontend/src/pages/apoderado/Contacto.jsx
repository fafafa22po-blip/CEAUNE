import { useQuery } from '@tanstack/react-query'
import { Phone, GraduationCap } from 'lucide-react'
import api from '../../lib/api'
import { formatGradoSeccion } from '../../lib/nivelAcademico'
import toast from 'react-hot-toast'
import { abrirWhatsApp } from '../../lib/externo'
import { QK } from '../../lib/queryKeys'
import { useHijo } from '../../context/HijoContext'

function IconWhatsApp({ size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function TarjetaContacto({ tipo, subtipo, badge, contacto, onAbrir }) {
  const tieneNumero = !!contacto.telefono
  const iniciales = `${contacto.nombre?.charAt(0) ?? ''}${contacto.apellido?.charAt(0) ?? ''}`.toUpperCase()

  return (
    <div className="card space-y-5">
      {/* Encabezado */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-marino text-white flex items-center justify-center font-bold text-2xl flex-shrink-0">
          {iniciales}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full ${badge}`}>
              {tipo}
            </span>
          </div>
          <p className="font-bold text-marino text-base leading-tight">
            {tipo === 'Tutor' ? 'Prof.' : 'Aux.'} {contacto.nombre} {contacto.apellido}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{subtipo}</p>
          {tieneNumero && (
            <p className="flex items-center gap-1.5 text-sm text-gray-600 font-medium mt-1.5">
              <Phone size={13} className="text-gray-400 flex-shrink-0" />
              {contacto.telefono}
            </p>
          )}
        </div>
      </div>

      {/* Botón WhatsApp */}
      <button
        onClick={onAbrir}
        disabled={!tieneNumero}
        className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-sm transition-all ${
          tieneNumero
            ? 'bg-green-500 hover:bg-green-600 active:bg-green-700 text-white shadow-sm shadow-green-200'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        }`}
      >
        <IconWhatsApp size={20} />
        {tieneNumero ? 'Escribir por WhatsApp' : 'Sin número registrado'}
      </button>
    </div>
  )
}

function SkeletonContacto() {
  return (
    <div className="card animate-pulse space-y-5">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-200 rounded w-16" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      </div>
      <div className="h-12 bg-gray-200 rounded-xl" />
    </div>
  )
}

export default function Contacto() {
  const { hijoActivo, hijos } = useHijo()
  const hijo = hijoActivo || hijos?.[0]

  const { data: contactos, isPending } = useQuery({
    queryKey: QK.contactos(hijo?.id),
    queryFn:  () => api.get(`/apoderado/hijo/${hijo.id}/contactos`).then(r => r.data),
    enabled:  !!hijo?.id,
    staleTime: 10 * 60_000,
  })

  const abrirAuxiliar = () => {
    if (!contactos?.auxiliar?.telefono) return toast.error('El auxiliar no tiene número registrado')
    const msg = `Hola, soy apoderado/a de *${hijo.nombre} ${hijo.apellido}* (${hijo.grado}° ${hijo.seccion} - ${hijo.nivel}). Le contacto respecto a mi hijo/a.`
    abrirWhatsApp(contactos.auxiliar.telefono, msg)
  }

  const abrirTutor = () => {
    if (!contactos?.tutor?.telefono) return toast.error('El tutor no tiene número registrado')
    const { nombre, apellido } = contactos.tutor
    const msg = `Estimado/a Prof. ${nombre} ${apellido}, soy apoderado/a de *${hijo.nombre} ${hijo.apellido}* (${hijo.grado}° ${hijo.seccion} - ${hijo.nivel}). Le contacto para consultar...`
    abrirWhatsApp(contactos.tutor.telefono, msg)
  }

  if (!hijo) {
    return (
      <div className="max-w-lg mx-auto">
        <div className="card text-center text-gray-400 py-12">
          No tienes hijos registrados
        </div>
      </div>
    )
  }

  const subtituloAuxiliar = `${hijo.nivel} — Responsable de comunicación`
  const subtituloTutor    = `${hijo.grado}° ${hijo.seccion} · ${hijo.nivel}`

  return (
    <div className="max-w-lg mx-auto space-y-5">

      {/* Encabezado */}
      <div data-tour="contacto-header">
        <h1 className="text-xl font-bold text-marino">Contacto</h1>
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
          <GraduationCap size={13} />
          <span className="capitalize">{hijo.nivel}</span>
          <span>·</span>
          <span>{formatGradoSeccion(hijo.nivel, hijo.grado, hijo.seccion)}</span>
          <span>·</span>
          <span className="font-medium text-gray-500">{hijo.nombre} {hijo.apellido}</span>
        </div>
      </div>

      {isPending ? (
        <>
          <SkeletonContacto />
          <SkeletonContacto />
        </>
      ) : (
        <>
          {/* Auxiliar primero — es el contacto principal con el apoderado */}
          {contactos?.auxiliar ? (
            <TarjetaContacto
              tipo="Auxiliar"
              subtipo={subtituloAuxiliar}
              badge="bg-blue-100 text-blue-700"
              contacto={contactos.auxiliar}
              onAbrir={abrirAuxiliar}
            />
          ) : (
            <div className="card border border-gray-100 text-center py-8 text-sm text-gray-400">
              Auxiliar no asignado
            </div>
          )}

          {/* Tutor */}
          {contactos?.tutor ? (
            <TarjetaContacto
              tipo="Tutor"
              subtipo={subtituloTutor}
              badge="bg-amber-100 text-amber-700"
              contacto={contactos.tutor}
              onAbrir={abrirTutor}
            />
          ) : (
            <div className="card border border-gray-100 text-center py-8 text-sm text-gray-400">
              Tutor no asignado
            </div>
          )}
        </>
      )}

      <p className="text-xs text-gray-400 text-center pb-2">
        Al tocar el botón se abrirá WhatsApp con un mensaje listo para enviar
      </p>
    </div>
  )
}
