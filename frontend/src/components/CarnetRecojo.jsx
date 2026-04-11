// Fotocheck de Recojo Seguro (72mm × 108mm vertical).
// Sin foto impresa — el QR es el único elemento de identidad.
// Mismo encabezado universitario que el carnet estudiantil.

import { formatGradoSeccion } from '../lib/nivelAcademico'

const MARINO = '#0a1f3d'
const DORADO = '#c9a227'

function PadlockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ width: '3mm', height: '3mm', display: 'inline-block', verticalAlign: 'middle', marginRight: '1mm' }}>
      <rect x="5" y="11" width="14" height="10" rx="2" fill={DORADO} />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={DORADO} strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="12" cy="16" r="1.5" fill={MARINO} />
    </svg>
  )
}

function DataRow({ label, value, bg }) {
  return (
    <div style={{
      background: bg || 'transparent',
      padding: '0.8mm 3mm',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.2mm',
    }}>
      <span style={{
        fontSize: '3.8pt',
        color: '#999999',
        letterSpacing: '0.4mm',
        textTransform: 'uppercase',
        fontWeight: 'bold',
        lineHeight: 1.2,
      }}>
        {label}
      </span>
      <span style={{
        fontSize: '6.5pt',
        color: MARINO,
        fontWeight: 'bold',
        lineHeight: 1.3,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {value || '—'}
      </span>
    </div>
  )
}

export default function CarnetRecojo({ persona, qrBase64 }) {
  const est = persona.estudiante || {}
  const aula = formatGradoSeccion(est.nivel, est.grado, est.seccion)

  const vigencia = persona.vigencia_hasta
    ? new Date(persona.vigencia_hasta + 'T00:00:00').toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
      })
    : '—'

  return (
    <div style={{
      width: '72mm',
      height: '108mm',
      background: '#ffffff',
      border: `1.5px solid ${MARINO}`,
      borderRadius: '3mm',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, Helvetica, sans-serif',
      boxSizing: 'border-box',
      flexShrink: 0,
    }}>

      {/* ── Encabezado universitario (idéntico al carnet estudiantil) ── */}
      <div style={{
        background: MARINO,
        height: '27mm',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 2mm 2.5mm',
        position: 'relative',
      }}>
        {/* Agujero de cordón */}
        <div style={{
          position: 'absolute',
          top: '1.5mm',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '4.5mm',
          height: '4.5mm',
          borderRadius: '50%',
          background: '#ffffff',
          border: `1.5px solid ${DORADO}`,
        }} />

        <img
          src="/logo.png"
          alt="Logo"
          style={{ height: '7mm', width: '7mm', objectFit: 'contain', marginBottom: '1.5mm' }}
        />
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5mm' }}>
          <span style={{ color: DORADO, fontWeight: 'bold', fontSize: '4.5pt', letterSpacing: '0.1mm', lineHeight: 1.2 }}>
            UNIVERSIDAD NACIONAL DE EDUCACIÓN ENRIQUE GUZMÁN Y VALLE
          </span>
          <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '5.8pt', letterSpacing: '0.2mm', lineHeight: 1.2 }}>
            COLEGIO EXPERIMENTAL DE APLICACIÓN
          </span>
          <span style={{ color: '#dddddd', fontSize: '3.8pt', lineHeight: 1.3 }}>
            I.E. por Convenio UNE-MED, según R.M. N° 045-2001-ED
          </span>
          <span style={{ color: '#cccccc', fontSize: '3.5pt', lineHeight: 1.3 }}>
            Jornada Escolar Completa con Formación Técnica
          </span>
        </div>
      </div>

      {/* ── Badge "Autorizado para recojo" ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '2mm 3mm 1.5mm',
        flexShrink: 0,
      }}>
        <div style={{
          background: DORADO,
          color: MARINO,
          fontSize: '5pt',
          fontWeight: 'bold',
          letterSpacing: '0.4mm',
          padding: '1mm 3.5mm',
          borderRadius: '1.5mm',
          textTransform: 'uppercase',
        }}>
          Autorizado para Recojo
        </div>
      </div>

      {/* ── Filas de datos ── */}
      <div style={{ flexShrink: 0 }}>
        <DataRow label="Alumno" value={`${est.nombre || ''} ${est.apellido || ''}`.trim()} bg="#f7f9fc" />
        <DataRow label="Aula" value={aula} />
        <DataRow label="Responsable" value={`${persona.nombre || ''} ${persona.apellido || ''}`.trim()} bg="#f7f9fc" />
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
            <DataRow label="Parentesco" value={persona.parentesco} />
          </div>
          <div style={{ width: '0.3mm', background: '#eeeeee', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <DataRow label="Vigencia" value={vigencia} />
          </div>
        </div>
      </div>

      {/* ── Separador dorado ── */}
      <div style={{
        height: '0.5mm',
        background: `${DORADO}80`,
        margin: '0 3mm',
        flexShrink: 0,
      }} />

      {/* ── QR protagonista ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5mm 3mm 1mm',
        gap: '1.5mm',
        minHeight: 0,
      }}>
        {qrBase64 ? (
          <img
            src={qrBase64}
            alt="QR"
            style={{ width: '38mm', height: '38mm', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '38mm',
            height: '38mm',
            border: `1.5px dashed ${MARINO}35`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f9f9f9',
            borderRadius: '2mm',
          }}>
            <span style={{ fontSize: '7pt', color: '#cccccc', letterSpacing: '0.5mm' }}>QR</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
          <div style={{ height: '0.4mm', width: '8mm', background: DORADO, borderRadius: '0.3mm' }} />
          <span style={{ fontSize: '3.8pt', color: '#aaaaaa', letterSpacing: '0.6mm' }}>
            ESCANEAR PARA VERIFICAR
          </span>
          <div style={{ height: '0.4mm', width: '8mm', background: DORADO, borderRadius: '0.3mm' }} />
        </div>
      </div>

      {/* ── Footer marino ── */}
      <div style={{
        background: MARINO,
        height: '8mm',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 3mm',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1mm' }}>
          <PadlockIcon />
          <span style={{ color: DORADO, fontSize: '4.5pt', fontWeight: 'bold', letterSpacing: '0.3mm' }}>
            RECOJO SEGURO
          </span>
        </div>
        <span style={{ color: '#888888', fontSize: '3.5pt', letterSpacing: '0.2mm' }}>
          Emitido por Secretaría
        </span>
      </div>

    </div>
  )
}
