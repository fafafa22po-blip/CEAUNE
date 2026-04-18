import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'ceaune_tour_apoderado_v1'

export const TOUR_STEPS = [
  {
    id: 'bienvenida',
    route: '/apoderado/inicio',
    selector: null,
    titulo: '¡Bienvenido a CEAUNE!',
    descripcion: 'En pocos pasos te mostramos todo lo que puedes hacer desde la app para estar al día con tu hijo.',
    tipo: 'welcome',
    icono: '👋',
  },
  {
    id: 'asistencias',
    route: '/apoderado/asistencias',
    selector: '[data-tour="asistencias-hero"]',
    titulo: 'Asistencias de tu hijo',
    descripcion: 'Revisa el historial mensual: días presentes, tardanzas y faltas en un calendario visual interactivo.',
    icono: '📅',
  },
  {
    id: 'comunicados',
    route: '/apoderado/comunicados',
    selector: '[data-tour="comunicados-header"]',
    titulo: 'Comunicados del colegio',
    descripcion: 'Aquí recibirás mensajes del colegio. Puedes leerlos y responder con documentos adjuntos.',
    icono: '✉️',
  },
  {
    id: 'justificar',
    route: '/apoderado/justificar',
    selector: '[data-tour="justificar-header"]',
    titulo: 'Justifica las faltas',
    descripcion: 'Cuando tu hijo falte, envía una justificación con foto del documento directamente desde la app.',
    icono: '📝',
  },
  {
    id: 'horario',
    route: '/apoderado/horario',
    selector: '[data-tour="horario-header"]',
    titulo: 'Horario y Libretas',
    descripcion: 'Consulta el horario de clases y las notas por bimestre de tu hijo en cualquier momento.',
    icono: '📚',
  },
  {
    id: 'contacto',
    route: '/apoderado/contacto',
    selector: '[data-tour="contacto-header"]',
    titulo: 'Contacto directo',
    descripcion: 'Escribe por WhatsApp al tutor o auxiliar de tu hijo con un solo toque desde aquí.',
    icono: '📞',
  },
  {
    id: 'fin',
    route: '/apoderado/inicio',
    selector: null,
    titulo: '¡Ya estás listo!',
    descripcion: 'Puedes volver a ver este tutorial tocando "Tutorial" en el menú "Más" cuando quieras.',
    tipo: 'finish',
    icono: '🎉',
  },
]

const TourContext = createContext(null)

export function TourProvider({ children }) {
  const [activo, setActivo] = useState(false)
  const [paso, setPaso] = useState(0)

  const iniciarTour = useCallback(() => {
    setPaso(0)
    setActivo(true)
  }, [])

  const siguiente = useCallback(() => {
    setPaso(p => {
      const next = p + 1
      if (next >= TOUR_STEPS.length) {
        setActivo(false)
        localStorage.setItem(STORAGE_KEY, '1')
        return 0
      }
      return next
    })
  }, [])

  const anterior = useCallback(() => {
    setPaso(p => Math.max(0, p - 1))
  }, [])

  const cerrar = useCallback(() => {
    setActivo(false)
    localStorage.setItem(STORAGE_KEY, '1')
  }, [])

  return (
    <TourContext.Provider value={{ activo, paso, pasos: TOUR_STEPS, iniciarTour, siguiente, anterior, cerrar }}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  return useContext(TourContext)
}

export function tourFueVisto() {
  return !!localStorage.getItem(STORAGE_KEY)
}
