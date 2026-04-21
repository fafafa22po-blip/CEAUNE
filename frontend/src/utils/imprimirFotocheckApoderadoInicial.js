// Fotocheck de apoderado para nivel inicial.
// Mismo diseño que los fotochecks de recojo (72mm × 108mm, A4 2×3).

import { resolveAulaInicial } from '../lib/nivelAcademico'

const MARINO = '#0a1f3d'
const DORADO = '#c9a227'

function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function urlToBase64(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function fotocheckHTML(c, logoBase64) {
  const est      = c.estudiante || {}
  const qrSrc    = esc(c.qrBase64 || '')
  const logoImg  = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="height:7mm;width:7mm;object-fit:contain;margin-bottom:1.5mm;" />`
    : ''

  const aula = est.nivel === 'inicial'
    ? `${esc(est.grado)} a&ntilde;os &mdash; Aula ${esc(resolveAulaInicial(est.grado, est.seccion))}`
    : `${esc(est.grado)}&deg; &ldquo;${esc(est.seccion)}&rdquo;`

  const alumnoNombre = esc(`${est.nombre || ''} ${est.apellido || ''}`.trim())
  const apoNombre    = esc(`${c.nombre || ''} ${c.apellido || ''}`.trim())

  return `
<div style="
  width:72mm;height:108mm;
  background:#ffffff;
  border:1.5px solid ${MARINO};
  border-radius:3mm;
  overflow:hidden;
  display:flex;flex-direction:column;
  font-family:Arial,Helvetica,sans-serif;
  box-sizing:border-box;
">

  <!-- Encabezado universitario -->
  <div style="
    background:${MARINO};height:27mm;flex-shrink:0;
    display:flex;flex-direction:column;
    align-items:center;justify-content:flex-end;
    padding:0 2mm 2.5mm;position:relative;
  ">
    <div style="
      position:absolute;top:1.5mm;left:50%;transform:translateX(-50%);
      width:4.5mm;height:4.5mm;border-radius:50%;
      background:#ffffff;border:1.5px solid ${DORADO};
    "></div>
    ${logoImg}
    <div style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:0.5mm;">
      <span style="color:${DORADO};font-weight:bold;font-size:4.5pt;letter-spacing:0.1mm;line-height:1.2;">
        UNIVERSIDAD NACIONAL DE EDUCACI&Oacute;N ENRIQUE GUZM&Aacute;N Y VALLE
      </span>
      <span style="color:#ffffff;font-weight:bold;font-size:5.8pt;letter-spacing:0.2mm;line-height:1.2;">
        COLEGIO EXPERIMENTAL DE APLICACI&Oacute;N
      </span>
      <span style="color:#dddddd;font-size:3.8pt;line-height:1.3;">
        I.E. por Convenio UNE-MED, seg&uacute;n R.M. N&deg; 045-2001-ED
      </span>
      <span style="color:#cccccc;font-size:3.5pt;line-height:1.3;">
        Jornada Escolar Completa con Formaci&oacute;n T&eacute;cnica
      </span>
    </div>
  </div>

  <!-- Badge -->
  <div style="display:flex;justify-content:center;padding:2mm 3mm 1.5mm;flex-shrink:0;">
    <div style="
      background:${DORADO};color:${MARINO};
      font-size:5pt;font-weight:bold;letter-spacing:0.4mm;
      padding:1mm 3.5mm;border-radius:1.5mm;text-transform:uppercase;
    ">Apoderado &mdash; Nivel Inicial</div>
  </div>

  <!-- Filas de datos -->
  <div style="flex-shrink:0;">
    <!-- Alumno -->
    <div style="background:#f7f9fc;padding:0.8mm 3mm;display:flex;flex-direction:column;gap:0.2mm;">
      <span style="font-size:3.8pt;color:#999;letter-spacing:0.4mm;text-transform:uppercase;font-weight:bold;line-height:1.2;">Alumno</span>
      <span style="font-size:6.5pt;color:${MARINO};font-weight:bold;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${alumnoNombre}</span>
    </div>
    <!-- Aula -->
    <div style="padding:0.8mm 3mm;display:flex;flex-direction:column;gap:0.2mm;">
      <span style="font-size:3.8pt;color:#999;letter-spacing:0.4mm;text-transform:uppercase;font-weight:bold;line-height:1.2;">Aula</span>
      <span style="font-size:6.5pt;color:${MARINO};font-weight:bold;line-height:1.3;">${aula}</span>
    </div>
    <!-- Apoderado -->
    <div style="background:#f7f9fc;padding:0.8mm 3mm;display:flex;flex-direction:column;gap:0.2mm;">
      <span style="font-size:3.8pt;color:#999;letter-spacing:0.4mm;text-transform:uppercase;font-weight:bold;line-height:1.2;">Apoderado</span>
      <span style="font-size:6.5pt;color:${MARINO};font-weight:bold;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${apoNombre}</span>
    </div>
    <!-- Parentesco + Año escolar -->
    <div style="display:flex;">
      <div style="flex:1;padding:0.8mm 3mm;display:flex;flex-direction:column;gap:0.2mm;">
        <span style="font-size:3.8pt;color:#999;letter-spacing:0.4mm;text-transform:uppercase;font-weight:bold;line-height:1.2;">Parentesco</span>
        <span style="font-size:6.5pt;color:${MARINO};font-weight:bold;line-height:1.3;">${esc(c.parentesco || 'Apoderado')}</span>
      </div>
      <div style="width:0.3mm;background:#eee;flex-shrink:0;"></div>
      <div style="flex:1;padding:0.8mm 3mm;display:flex;flex-direction:column;gap:0.2mm;">
        <span style="font-size:3.8pt;color:#999;letter-spacing:0.4mm;text-transform:uppercase;font-weight:bold;line-height:1.2;">A&ntilde;o Escolar</span>
        <span style="font-size:6.5pt;color:${MARINO};font-weight:bold;line-height:1.3;">${new Date().getFullYear()}</span>
      </div>
    </div>
  </div>

  <!-- Separador dorado -->
  <div style="height:0.5mm;background:${DORADO}80;margin:0 3mm;flex-shrink:0;"></div>

  <!-- QR protagonista -->
  <div style="
    flex:1;display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    padding:1.5mm 3mm 1mm;gap:1.5mm;min-height:0;
  ">
    ${qrSrc
      ? `<img src="${qrSrc}" alt="QR" style="width:38mm;height:38mm;object-fit:contain;display:block;" />`
      : `<div style="
           width:38mm;height:38mm;
           border:1.5px dashed ${MARINO}35;
           display:flex;align-items:center;justify-content:center;
           background:#f9f9f9;border-radius:2mm;
         "><span style="font-size:7pt;color:#ccc;letter-spacing:0.5mm;">QR</span></div>`
    }
    <div style="display:flex;align-items:center;gap:1.5mm;">
      <div style="height:0.4mm;width:8mm;background:${DORADO};border-radius:0.3mm;"></div>
      <span style="font-size:3.8pt;color:#aaa;letter-spacing:0.6mm;">ESCANEAR PARA VERIFICAR</span>
      <div style="height:0.4mm;width:8mm;background:${DORADO};border-radius:0.3mm;"></div>
    </div>
  </div>

  <!-- Footer marino -->
  <div style="
    background:${MARINO};height:8mm;flex-shrink:0;
    display:flex;align-items:center;justify-content:space-between;
    padding:0 3mm;
  ">
    <div style="display:flex;align-items:center;gap:1mm;">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:3mm;height:3mm;display:inline-block;">
        <rect x="3" y="3" width="7" height="7" rx="1" fill="${DORADO}"/>
        <rect x="14" y="3" width="7" height="7" rx="1" fill="${DORADO}"/>
        <rect x="3" y="14" width="7" height="7" rx="1" fill="${DORADO}"/>
        <rect x="14" y="14" width="3" height="3" rx="0.5" fill="${DORADO}"/>
        <rect x="18" y="14" width="3" height="3" rx="0.5" fill="${DORADO}"/>
        <rect x="14" y="18" width="3" height="3" rx="0.5" fill="${DORADO}"/>
        <rect x="18" y="18" width="3" height="3" rx="0.5" fill="${DORADO}"/>
      </svg>
      <span style="color:${DORADO};font-size:4.5pt;font-weight:bold;letter-spacing:0.3mm;">APO INICIAL</span>
    </div>
    <span style="color:#888;font-size:3.5pt;letter-spacing:0.2mm;">Emitido por Secretar&iacute;a</span>
  </div>

</div>`
}

/**
 * Abre ventana de impresión con los fotochecks de apoderado inicial.
 * @param {Array} items — [{ nombre, apellido, parentesco, estudiante, qrBase64 }]
 */
export async function imprimirFotocheckApoderadoInicial(items) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Por favor permite ventanas emergentes en este sitio para imprimir.')
    return
  }

  win.document.write(`<!DOCTYPE html><html><body style="font-family:Arial;text-align:center;padding:40px;color:#555;">
    <p>Preparando fotocheck...</p></body></html>`)

  const logoBase64 = await urlToBase64(`${window.location.origin}/logo.png`)

  const fecha = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Fotocheck Apoderado Inicial &mdash; CEAUNE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 5mm; }
    body { background: white; font-family: Arial, Helvetica, sans-serif; }
    .header-impresion {
      font-size: 8pt; color: #888; text-align: center;
      margin-bottom: 6mm; padding-bottom: 3mm;
      border-bottom: 0.3mm solid #eee;
    }
    .grid-fotochecks {
      display: grid;
      grid-template-columns: repeat(2, 72mm);
      gap: 6mm 8mm;
      justify-content: center;
    }
    .fotocheck-wrapper {
      outline: 0.4mm dashed #dddddd;
      outline-offset: 2.5mm;
      break-inside: avoid;
    }
    @media print {
      .header-impresion { display: none; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <p class="header-impresion">
    CEAUNE &mdash; Fotochecks Apoderado Inicial &mdash;
    ${items.length} fotocheck${items.length !== 1 ? 's' : ''} &mdash; ${esc(fecha)}
  </p>
  <div class="grid-fotochecks">
    ${items.map(c => `<div class="fotocheck-wrapper">${fotocheckHTML(c, logoBase64)}</div>`).join('\n    ')}
  </div>
  <script>window.onload = function () { window.print(); };<\/script>
</body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}
