// Carnet de cuello (72mm × 108mm vertical).
// QR como protagonista para escaneo de asistencia e inspección.
// Usa estilos inline para garantizar fidelidad visual en cualquier contexto.

import { formatGrado } from '../lib/nivelAcademico'

const MARINO = '#0a1f3d'
const DORADO = '#c9a227'

const NIVEL_LABEL = {
  inicial: 'INICIAL',
  primaria: 'PRIMARIA',
  secundaria: 'SECUNDARIA',
}

function AvatarSexo({ sexo, width, height }) {
  const esM = sexo === 'M'
  const esF = sexo === 'F'
  const bg   = esM ? '#e8ecf4' : esF ? '#fdf3e3' : '#f0f0f0'
  const fill = esM ? '#1a3a6b' : esF ? '#c9a227' : '#aaaaaa'
  const op   = esM ? 0.55 : esF ? 0.6 : 0.5
  return (
    <svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg"
      style={{ width, height, display: 'block' }}>
      <rect width="60" height="80" fill={bg} rx="3"/>
      {esF && <ellipse cx="30" cy="19" rx="17" ry="18" fill={fill} opacity={op - 0.2}/>}
      <circle cx="30" cy={esF ? 23 : 26} r={esF ? 13 : 15} fill={fill} opacity={op}/>
      {esF
        ? <path d="M18 50 L4 80 L56 80 L42 50 Q30 58 18 50Z" fill={fill} opacity={op}/>
        : <path d="M4 80 C4 54 14 48 30 48 C46 48 56 54 56 80Z" fill={fill} opacity={op}/>
      }
    </svg>
  )
}

function formatApellido(apellido) {
  if (!apellido) return ''
  const partes = String(apellido).trim().split(/\s+/)
  if (partes.length < 2) return partes[0]
  return partes[0] + ' ' + partes[1][0].toUpperCase() + '.'
}

export default function CarnetEstudianteVertical({ estudiante, qrBase64 }) {
  const nivel = NIVEL_LABEL[estudiante.nivel] || (estudiante.nivel || '').toUpperCase()

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

      {/* Franja superior marino */}
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

      {/* Fila info: foto pequeña + datos del estudiante */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '2.5mm 3mm',
        gap: '2.5mm',
        flexShrink: 0,
      }}>
        {/* Avatar */}
        <div style={{
          width: '21mm',
          height: '27mm',
          flexShrink: 0,
          border: '1px solid #e0e0e0',
          borderRadius: '1.5mm',
          overflow: 'hidden',
        }}>
          <AvatarSexo sexo={estudiante.sexo} width="21mm" height="27mm" />
        </div>

        {/* Datos del estudiante */}
        <div style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5mm',
        }}>
          <div style={{
            fontWeight: 'bold',
            fontSize: '9pt',
            color: MARINO,
            textTransform: 'uppercase',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {formatApellido(estudiante.apellido)}
          </div>
          <div style={{
            fontSize: '7.5pt',
            color: MARINO,
            textTransform: 'uppercase',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {estudiante.nombre}
          </div>
          <div style={{ height: '0.5mm', background: DORADO, borderRadius: '0.3mm', margin: '0.5mm 0' }} />
          <div style={{
            alignSelf: 'flex-start',
            background: MARINO,
            color: '#ffffff',
            fontSize: '4.5pt',
            fontWeight: 'bold',
            padding: '0.8mm 2.5mm',
            borderRadius: '1mm',
            letterSpacing: '0.3mm',
          }}>
            {nivel}
          </div>
          <div style={{ fontSize: '6pt', color: '#555555', lineHeight: 1.5 }}>
            {estudiante.nivel === 'inicial' ? (
              <>
                <span style={{ color: '#999999' }}>AULA </span>
                <span style={{ fontWeight: 'bold', color: MARINO }}>{estudiante.seccion}</span>
                <span style={{ color: '#999999', marginLeft: '2.5mm' }}>{formatGrado(estudiante.nivel, estudiante.grado).toUpperCase()}</span>
              </>
            ) : (
              <>
                <span style={{ color: '#999999' }}>GRADO </span>
                <span style={{ fontWeight: 'bold', color: MARINO }}>{estudiante.grado}°</span>
                <span style={{ color: '#999999', marginLeft: '2.5mm' }}>SEC. </span>
                <span style={{ fontWeight: 'bold', color: MARINO }}>"{estudiante.seccion}"</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Separador dorado */}
      <div style={{
        height: '0.5mm',
        background: `${DORADO}80`,
        margin: '0 3mm',
        flexShrink: 0,
      }} />

      {/* QR protagonista */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2mm 3mm 2mm',
        gap: '1.5mm',
        minHeight: 0,
      }}>
        {qrBase64 ? (
          <img
            src={qrBase64}
            alt="QR"
            style={{ width: '40mm', height: '40mm', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <div style={{
            width: '40mm',
            height: '40mm',
            border: `1.5px dashed ${MARINO}35`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f9f9f9',
            borderRadius: '2mm',
          }}>
            <span style={{ fontSize: '8pt', color: '#cccccc', letterSpacing: '0.5mm' }}>QR</span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5mm' }}>
          <div style={{ height: '0.4mm', width: '10mm', background: DORADO, borderRadius: '0.3mm' }} />
          <span style={{ fontSize: '4pt', color: '#aaaaaa', letterSpacing: '0.7mm' }}>
            ESCANEAR AQUÍ
          </span>
          <div style={{ height: '0.4mm', width: '10mm', background: DORADO, borderRadius: '0.3mm' }} />
        </div>
      </div>

      {/* Franja inferior dorada */}
      <div style={{
        background: DORADO,
        height: '8mm',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: MARINO, fontSize: '4.5pt', fontWeight: 'bold', letterSpacing: '0.4mm' }}>
          CARNET ESTUDIANTIL — CONTROL DE ASISTENCIA
        </span>
      </div>

    </div>
  )
}
