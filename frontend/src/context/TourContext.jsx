import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'ceaune_tour_apoderado_v2'

export const TOUR_STEPS = [
  // ── 0. Bienvenida ─────────────────────────────────────────────────────────
  {
    id: 'bienvenida',
    route: '/apoderado/inicio',
    selector: null,
    tipo: 'welcome',
    titulo: '¡Hola! Soy Ceauno 🐿️',
    descripcion: 'Soy tu guía en CEAUNE. En 2 minutos te muestro todo lo que puedes hacer para estar siempre al día con tu hijo.',
  },

  // ── 1. Inicio: banner ─────────────────────────────────────────────────────
  {
    id: 'inicio-banner',
    route: '/apoderado/inicio',
    selector: '[data-tour="inicio-banner"]',
    titulo: 'Tu resumen del día',
    descripcion: 'De un vistazo ves el estado de asistencia de hoy y el porcentaje mensual de tu hijo.',
    icono: '🏠',
  },

  // ── 2. Inicio: contacto rápido ────────────────────────────────────────────
  {
    id: 'inicio-contacto',
    route: '/apoderado/inicio',
    selector: '[data-tour="inicio-contacto"]',
    titulo: 'Contacto rápido desde Inicio',
    descripcion: 'Sin entrar a ningún menú, puedes escribir directamente al tutor o auxiliar de tu hijo por WhatsApp.',
    icono: '💬',
    hint: 'Un toque y se abre WhatsApp al instante',
  },

  // ── 3. Asistencias: hero stats ────────────────────────────────────────────
  {
    id: 'asistencias-hero',
    route: '/apoderado/asistencias',
    selector: '[data-tour="asistencias-hero"]',
    titulo: 'Estadísticas del mes',
    descripcion: 'Porcentaje de asistencia, días asistidos, tardanzas y faltas del mes. Usa las flechas para navegar meses anteriores.',
    icono: '📊',
  },

  // ── 4. Asistencias: calendario (interacción manual) ──────────────────────
  {
    id: 'asistencias-calendario',
    route: '/apoderado/asistencias',
    selector: '[data-tour="asistencias-calendario"]',
    titulo: 'Calendario de asistencias',
    descripcion: '✓ puntual  ·  ! tardanza  ·  ✗ falta  ·  — sin registro.',
    icono: '📅',
    waitForInteraction: 'asistencias-primer-dia',
    hint: 'Toca un día del calendario para ver el detalle',
  },

  // ── 5. Asistencias: panel detalle (sin navegar) ───────────────────────────
  {
    id: 'asistencias-detalle',
    route: null,
    selector: '[data-tour="asistencias-detalle"]',
    titulo: 'Detalle del registro del día',
    descripcion: 'Hora exacta de ingreso y salida, estado (puntual / tardanza) y observaciones que el tutor haya dejado ese día.',
    icono: '🔍',
  },

  // ── 6. Comunicados ────────────────────────────────────────────────────────
  {
    id: 'comunicados-lista',
    route: '/apoderado/comunicados',
    selector: '[data-tour="comunicados-lista"]',
    titulo: 'Bandeja de comunicados',
    descripcion: 'El colegio te envía avisos, citaciones y noticias aquí. Toca cualquiera para leerlo y responder con archivos adjuntos.',
    icono: '✉️',
  },

  // ── 7. Justificar: métricas ───────────────────────────────────────────────
  {
    id: 'justificar-metricas',
    route: '/apoderado/justificar',
    selector: '[data-tour="justificar-metricas"]',
    titulo: 'Panel de justificaciones',
    descripcion: 'Total de faltas, cuántas están pendientes, cuáles están en revisión por el colegio y cuántas ya fueron aprobadas.',
    icono: '📋',
  },

  // ── 8. Justificar: lista ──────────────────────────────────────────────────
  {
    id: 'justificar-lista',
    route: '/apoderado/justificar',
    selector: '[data-tour="justificar-lista"]',
    titulo: 'Justifica con un documento',
    descripcion: 'Toca una falta para enviar la justificación. Puedes adjuntar una foto tomada con el escáner de documentos de la app.',
    icono: '📝',
    hint: 'Usa el escáner para capturar el doc médico directamente',
  },

  // ── 9. Horario ────────────────────────────────────────────────────────────
  {
    id: 'horario',
    route: '/apoderado/horario',
    selector: '[data-tour="horario-header"]',
    titulo: 'Horario de clases',
    descripcion: 'Consulta el horario semanal de tu hijo, visualízalo aquí mismo o descárgalo como PDF cuando quieras.',
    icono: '📚',
  },

  // ── 10. Libretas ──────────────────────────────────────────────────────────
  {
    id: 'libretas',
    route: '/apoderado/libretas',
    selector: '[data-tour="libretas-bimestres"]',
    titulo: 'Libretas de notas',
    descripcion: 'Revisa las notas por bimestre. Los puntos verdes indican los bimestres que ya tienen libreta disponible para ver.',
    icono: '📓',
  },

  // ── 11. Contacto ─────────────────────────────────────────────────────────
  {
    id: 'contacto',
    route: '/apoderado/contacto',
    selector: '[data-tour="contacto-cards"]',
    titulo: 'Contacto del tutor y auxiliar',
    descripcion: 'Encuentra el nombre, cargo y número de WhatsApp del tutor y auxiliar de tu hijo. Un toque para escribirles.',
    icono: '📞',
    hint: 'Toca el botón verde para abrir WhatsApp directamente',
  },

  // ── 12. Fin ───────────────────────────────────────────────────────────────
  {
    id: 'fin',
    route: '/apoderado/inicio',
    selector: null,
    tipo: 'finish',
    titulo: '¡Ya dominas CEAUNE! 🎉',
    descripcion: 'Ahora sabes todo lo que puedes hacer. Si quieres repasar, ve a Más → Tutorial. ¡Tu hijo está en buenas manos!',
  },
]

const TourContext = createContext(null)

export function TourProvider({ children }) {
  const [activo, setActivo] = useState(false)
  const [paso,   setPaso]   = useState(0)

  const iniciarTour = useCallback(() => {
    setActivo(prev => {
      if (prev) return prev   // ya activo, no reiniciar
      setPaso(0)
      return true
    })
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
