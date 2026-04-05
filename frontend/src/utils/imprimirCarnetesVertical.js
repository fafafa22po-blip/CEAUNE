// Utilidad para imprimir carnets de cuello (vertical 63mm × 90mm).
// Layout A4 portrait: 2 columnas × 3 filas = 6 carnets por hoja.

const MARINO = '#0a1f3d'
const DORADO = '#c9a227'

const NIVEL_LABEL = {
  inicial: 'INICIAL',
  primaria: 'PRIMARIA',
  secundaria: 'SECUNDARIA',
}

function avatarSVG(sexo) {
  const esM = sexo === 'M', esF = sexo === 'F'
  const bg   = esM ? '#e8ecf4' : esF ? '#fdf3e3' : '#f0f0f0'
  const fill = esM ? '#1a3a6b' : esF ? '#c9a227' : '#aaaaaa'
  const op   = esM ? 0.55 : esF ? 0.6 : 0.5
  const op2  = op - 0.2
  const cy   = esF ? 23 : 26
  const r    = esF ? 13 : 15
  const body = esF
    ? `<path d="M18 50 L4 80 L56 80 L42 50 Q30 58 18 50Z" fill="${fill}" opacity="${op}"/>`
    : `<path d="M4 80 C4 54 14 48 30 48 C46 48 56 54 56 80Z" fill="${fill}" opacity="${op}"/>`
  const hair = esF
    ? `<ellipse cx="30" cy="19" rx="17" ry="18" fill="${fill}" opacity="${op2}"/>`
    : ''
  return `<svg viewBox="0 0 60 80" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block;">
    <rect width="60" height="80" fill="${bg}" rx="3"/>
    ${hair}
    <circle cx="30" cy="${cy}" r="${r}" fill="${fill}" opacity="${op}"/>
    ${body}
  </svg>`
}

function formatApellido(apellido) {
  if (!apellido) return ''
  const partes = String(apellido).trim().split(/\s+/)
  if (partes.length < 2) return partes[0]
  return partes[0] + ' ' + partes[1][0].toUpperCase() + '.'
}

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

function carnetVerticalHTML(c, logoBase64) {
  const nivel = NIVEL_LABEL[c.nivel] || (c.nivel || '').toUpperCase()
  const qrSrc = esc(c.qrBase64 || '')

  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="height:7mm;width:7mm;object-fit:contain;flex-shrink:0;" />`
    : ''

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

  <!-- Franja superior marino -->
  <div style="
    background:${MARINO};height:27mm;flex-shrink:0;
    display:flex;flex-direction:column;
    align-items:center;justify-content:flex-end;
    padding:0 2mm 2.5mm;position:relative;
  ">
    <!-- Agujero de cordón -->
    <div style="
      position:absolute;top:1.5mm;left:50%;transform:translateX(-50%);
      width:4.5mm;height:4.5mm;border-radius:50%;
      background:#ffffff;border:1.5px solid ${DORADO};
    "></div>

    ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height:7mm;width:7mm;object-fit:contain;margin-bottom:1.5mm;" />` : ''}
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

  <!-- Fila info: foto + datos -->
  <div style="display:flex;align-items:center;padding:2.5mm 3mm;gap:2.5mm;flex-shrink:0;">
    <!-- Foto -->
    <div style="
      width:21mm;height:27mm;flex-shrink:0;
      border:1px solid #e0e0e0;border-radius:1.5mm;overflow:hidden;
    ">
      ${avatarSVG(c.sexo)}
    </div>

    <!-- Datos -->
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1.5mm;">
      <div style="
        font-weight:bold;font-size:9pt;color:${MARINO};
        text-transform:uppercase;line-height:1.2;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      ">${esc(formatApellido(c.apellido))}</div>
      <div style="
        font-size:7.5pt;color:${MARINO};
        text-transform:uppercase;line-height:1.2;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      ">${esc(c.nombre)}</div>
      <div style="height:0.5mm;background:${DORADO};border-radius:0.3mm;margin:0.5mm 0;"></div>
      <div style="
        align-self:flex-start;background:${MARINO};color:#ffffff;
        font-size:4.5pt;font-weight:bold;
        padding:0.8mm 2.5mm;border-radius:1mm;letter-spacing:0.3mm;
      ">${nivel}</div>
      <div style="font-size:6pt;color:#555555;line-height:1.5;">
        <span style="color:#999999;">GRADO </span>
        <span style="font-weight:bold;color:${MARINO};">${esc(c.grado)}&deg;</span>
        <span style="color:#999999;margin-left:2.5mm;">SEC. </span>
        <span style="font-weight:bold;color:${MARINO};">&ldquo;${esc(c.seccion)}&rdquo;</span>
      </div>
    </div>
  </div>

  <!-- Separador dorado -->
  <div style="height:0.5mm;background:${DORADO}80;margin:0 3mm;flex-shrink:0;"></div>

  <!-- QR protagonista -->
  <div style="
    flex:1;display:flex;flex-direction:column;
    align-items:center;justify-content:center;
    padding:2mm 3mm 1.5mm;gap:1.5mm;min-height:0;
  ">
    ${qrSrc
      ? `<img src="${qrSrc}" alt="QR" style="width:40mm;height:40mm;object-fit:contain;display:block;" />`
      : `<div style="
           width:40mm;height:40mm;
           border:1.5px dashed ${MARINO}35;
           display:flex;align-items:center;justify-content:center;
           background:#f9f9f9;border-radius:2mm;
         ">
           <span style="font-size:7pt;color:#cccccc;letter-spacing:0.5mm;">QR</span>
         </div>`
    }
    <div style="display:flex;align-items:center;gap:1.5mm;">
      <div style="height:0.4mm;width:10mm;background:${DORADO};border-radius:0.3mm;"></div>
      <span style="font-size:4pt;color:#aaaaaa;letter-spacing:0.7mm;">ESCANEAR AQU&Iacute;</span>
      <div style="height:0.4mm;width:10mm;background:${DORADO};border-radius:0.3mm;"></div>
    </div>
  </div>

  <!-- Franja inferior dorada -->
  <div style="
    background:${DORADO};height:8mm;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
  ">
    <span style="color:${MARINO};font-size:4.5pt;font-weight:bold;letter-spacing:0.4mm;">
      CARNET ESTUDIANTIL &mdash; CONTROL DE ASISTENCIA
    </span>
  </div>

</div>`
}

/**
 * Abre una ventana nueva con los carnets de cuello listos para imprimir.
 * Layout A4 portrait: 2 columnas × 3 filas = 6 carnets por hoja.
 * @param {Array<{ nombre, apellido, dni, nivel, grado, seccion, qr_token, qrBase64 }>} carnets
 */
export async function imprimirCarnetesVertical(carnets) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Por favor permite ventanas emergentes en este sitio para imprimir.')
    return
  }

  win.document.write(`<!DOCTYPE html><html><body style="font-family:Arial;text-align:center;padding:40px;color:#555;">
    <p>Preparando carnets de cuello...</p></body></html>`)

  const logoBase64 = await urlToBase64(`${window.location.origin}/logo.png`)

  const fecha = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Carnets de Cuello CEAUNE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    @page {
      size: A4 portrait;
      margin: 5mm;
    }

    body {
      background: white;
      font-family: Arial, Helvetica, sans-serif;
    }

    .header-impresion {
      font-size: 8pt;
      color: #888;
      text-align: center;
      margin-bottom: 6mm;
      padding-bottom: 3mm;
      border-bottom: 0.3mm solid #eee;
    }

    /* 2 cols × 3 filas = 6 carnets por A4 */
    .grid-carnets {
      display: grid;
      grid-template-columns: repeat(2, 72mm);
      gap: 6mm 8mm;
      justify-content: center;
    }

    .carnet-wrapper {
      outline: 0.4mm dashed #dddddd;
      outline-offset: 2.5mm;
      break-inside: avoid;
    }

    @media print {
      .header-impresion { display: none; }
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>

  <p class="header-impresion">
    CEAUNE &mdash; Carnets de Cuello &mdash;
    ${carnets.length} carnet${carnets.length !== 1 ? 's' : ''} &mdash; ${esc(fecha)}
  </p>

  <div class="grid-carnets">
    ${carnets.map(c => `<div class="carnet-wrapper">${carnetVerticalHTML(c, logoBase64)}</div>`).join('\n    ')}
  </div>

  <script>
    window.onload = function () { window.print(); };
  </script>

</body>
</html>`

  win.document.open()
  win.document.write(html)
  win.document.close()
}
