// Vista previa del carnet estudiantil (97mm × 68mm horizontal).
// Usa estilos inline para garantizar fidelidad visual en cualquier contexto.

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

export default function CarnetEstudiante({ estudiante, qrBase64 }) {
  const nivel = NIVEL_LABEL[estudiante.nivel] || (estudiante.nivel || '').toUpperCase()

  return (
    <div style={{
      width: '97mm',
      height: '68mm',
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
        height: '21mm',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 3mm',
        gap: '2.5mm',
      }}>
        <img
          src="/logo.png"
          alt="Logo"
          style={{ height: '13mm', width: '13mm', objectFit: 'contain', flexShrink: 0 }}
        />
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: '0.6mm',
        }}>
          <span style={{ color: DORADO, fontWeight: 'bold', fontSize: '5.2pt', letterSpacing: '0.15mm', lineHeight: 1.2, textAlign: 'center' }}>
            UNIVERSIDAD NACIONAL DE EDUCACIÓN ENRIQUE GUZMÁN Y VALLE
          </span>
          <span style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '7pt', letterSpacing: '0.2mm', lineHeight: 1.2, textAlign: 'center' }}>
            COLEGIO EXPERIMENTAL DE APLICACIÓN
          </span>
          <span style={{ color: '#dddddd', fontSize: '4.8pt', lineHeight: 1.3, textAlign: 'center' }}>
            I.E. por Convenio UNE-MED, según R.M. N° 045-2001-ED
          </span>
          <span style={{ color: '#cccccc', fontSize: '4.3pt', lineHeight: 1.3, textAlign: 'center' }}>
            Modelo Educativo: Jornada Escolar Completa con Formación Técnica
          </span>
        </div>
      </div>

      {/* Cuerpo */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        padding: '2.5mm 3mm',
        gap: '2.5mm',
        minHeight: 0,
      }}>

        {/* Columna foto */}
        <div style={{
          width: '25mm',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5mm',
          height: '100%',
          justifyContent: 'center',
        }}>
          <div style={{
            width: '21mm',
            height: '30mm',
            border: '1px solid #e0e0e0',
            borderRadius: '1.5mm',
            overflow: 'hidden',
          }}>
            <AvatarSexo sexo={estudiante.sexo} width="21mm" height="30mm" />
          </div>
          <div style={{
            background: MARINO,
            color: '#ffffff',
            fontSize: '4.5pt',
            fontWeight: 'bold',
            padding: '1mm 2mm',
            borderRadius: '1mm',
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box',
            letterSpacing: '0.3mm',
          }}>
            {nivel}
          </div>
        </div>

        {/* Columna información */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '1.5mm',
          minWidth: 0,
        }}>
          <div style={{
            fontWeight: 'bold',
            fontSize: '9pt',
            color: MARINO,
            lineHeight: 1.2,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {formatApellido(estudiante.apellido)}
          </div>
          <div style={{
            fontSize: '7.5pt',
            color: MARINO,
            lineHeight: 1.2,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {estudiante.nombre}
          </div>
          <div style={{ height: '0.7mm', background: DORADO, margin: '1mm 0', borderRadius: '0.3mm' }} />
          <div style={{ display: 'flex', gap: '4mm', fontSize: '6.5pt', color: '#555555', lineHeight: 1.5 }}>
            <div>
              <span style={{ color: '#999999', fontSize: '6pt' }}>GRADO </span>
              <span style={{ fontWeight: 'bold' }}>{estudiante.grado}°</span>
            </div>
            <div>
              <span style={{ color: '#999999', fontSize: '6pt' }}>SECCIÓN </span>
              <span style={{ fontWeight: 'bold' }}>"{estudiante.seccion}"</span>
            </div>
          </div>
        </div>

        {/* Columna QR */}
        <div style={{
          width: '32mm',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1mm',
        }}>
          {qrBase64 ? (
            <img
              src={qrBase64}
              alt="QR"
              style={{ width: '28mm', height: '28mm', objectFit: 'contain', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '28mm',
              height: '28mm',
              border: '1px dashed #cccccc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f9f9f9',
            }}>
              <span style={{ fontSize: '5pt', color: '#cccccc' }}>QR</span>
            </div>
          )}
          <span style={{ fontSize: '4pt', color: '#bbbbbb', letterSpacing: '0.3mm' }}>
            {(estudiante.qr_token || '').slice(-8)}
          </span>
        </div>

      </div>

      {/* Franja inferior dorada */}
      <div style={{
        background: DORADO,
        height: '6mm',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <span style={{ color: MARINO, fontSize: '5pt', fontWeight: 'bold', letterSpacing: '0.4mm' }}>
          CARNET ESTUDIANTIL — CONTROL DE ASISTENCIA
        </span>
      </div>

    </div>
  )
}
