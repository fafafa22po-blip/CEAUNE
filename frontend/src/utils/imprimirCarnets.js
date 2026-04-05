// Utilidad para imprimir carnets estudiantiles en ventana nueva.
// Genera HTML self-contained (sin dependencias externas) y llama window.print().

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

// Convierte una URL a base64 data URL para embeber en la ventana de impresión
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

function carnetHTML(c, logoBase64) {
  const nivel = NIVEL_LABEL[c.nivel] || (c.nivel || '').toUpperCase()
  const qrSrc = esc(c.qrBase64 || '')
  const ultimoToken = esc((c.qr_token || '').slice(-8))

  const logoImg = logoBase64
    ? `<img src="${logoBase64}" alt="Logo" style="height:8mm;width:8mm;object-fit:contain;flex-shrink:0;" />`
    : ''

  return `
<div style="
  width:97mm;height:68mm;
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
    background:${MARINO};height:21mm;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;padding:0 3mm;gap:2.5mm;
  ">
    ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="height:13mm;width:13mm;object-fit:contain;flex-shrink:0;" />` : ''}
    <div style="flex:1;display:flex;flex-direction:column;align-items:stretch;gap:0.6mm;">
      <span style="color:${DORADO};font-weight:bold;font-size:5.2pt;letter-spacing:0.15mm;line-height:1.2;text-align:center;">
        UNIVERSIDAD NACIONAL DE EDUCACI&Oacute;N ENRIQUE GUZM&Aacute;N Y VALLE
      </span>
      <span style="color:#ffffff;font-weight:bold;font-size:7pt;letter-spacing:0.2mm;line-height:1.2;text-align:center;">
        COLEGIO EXPERIMENTAL DE APLICACI&Oacute;N
      </span>
      <span style="color:#dddddd;font-size:4.8pt;line-height:1.3;text-align:center;">
        I.E. por Convenio UNE-MED, seg&uacute;n R.M. N&deg; 045-2001-ED
      </span>
      <span style="color:#cccccc;font-size:4.3pt;line-height:1.3;text-align:center;">
        Modelo Educativo: Jornada Escolar Completa con Formaci&oacute;n T&eacute;cnica
      </span>
    </div>
  </div>

  <!-- Cuerpo -->
  <div style="
    flex:1;display:flex;align-items:center;
    padding:2.5mm 3mm;gap:2.5mm;min-height:0;
  ">

    <!-- Columna foto -->
    <div style="
      width:25mm;flex-shrink:0;
      display:flex;flex-direction:column;align-items:center;
      gap:1.5mm;height:100%;justify-content:center;
    ">
      <div style="
        width:21mm;height:30mm;
        border:1px solid #e0e0e0;border-radius:1.5mm;overflow:hidden;
      ">
        ${avatarSVG(c.sexo)}
      </div>
      <div style="
        background:${MARINO};color:#ffffff;
        font-size:4.5pt;font-weight:bold;
        padding:1mm 2mm;border-radius:1mm;
        text-align:center;width:100%;box-sizing:border-box;
        letter-spacing:0.3mm;
      ">
        ${nivel}
      </div>
    </div>

    <!-- Columna información -->
    <div style="
      flex:1;display:flex;flex-direction:column;
      justify-content:center;gap:1.5mm;min-width:0;
    ">
      <div style="
        font-weight:bold;font-size:9pt;color:${MARINO};
        line-height:1.2;text-transform:uppercase;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      ">${esc(formatApellido(c.apellido))}</div>
      <div style="
        font-size:7.5pt;color:${MARINO};
        line-height:1.2;text-transform:uppercase;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      ">${esc(c.nombre)}</div>
      <div style="height:0.7mm;background:${DORADO};margin:1mm 0;border-radius:0.3mm;"></div>
      <div style="display:flex;gap:4mm;font-size:6.5pt;color:#555555;line-height:1.5;">
        <div>
          <span style="color:#999999;font-size:6pt;">GRADO&nbsp;</span>
          <span style="font-weight:bold;">${esc(c.grado)}&deg;</span>
        </div>
        <div>
          <span style="color:#999999;font-size:6pt;">SECCI&Oacute;N&nbsp;</span>
          <span style="font-weight:bold;">&ldquo;${esc(c.seccion)}&rdquo;</span>
        </div>
      </div>
    </div>

    <!-- Columna QR -->
    <div style="
      width:32mm;flex-shrink:0;
      display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:1mm;
    ">
      ${qrSrc
        ? `<img src="${qrSrc}" alt="QR" style="width:28mm;height:28mm;object-fit:contain;display:block;" />`
        : `<div style="width:28mm;height:28mm;border:1px dashed #ccc;display:flex;align-items:center;justify-content:center;">
             <span style="font-size:5pt;color:#ccc;">QR</span>
           </div>`
      }
      <span style="font-size:4pt;color:#bbbbbb;letter-spacing:0.3mm;">${ultimoToken}</span>
    </div>

  </div>

  <!-- Franja inferior dorada -->
  <div style="
    background:${DORADO};height:6mm;flex-shrink:0;
    display:flex;align-items:center;justify-content:center;
  ">
    <span style="color:${MARINO};font-size:5pt;font-weight:bold;letter-spacing:0.4mm;">
      CARNET ESTUDIANTIL &mdash; CONTROL DE ASISTENCIA
    </span>
  </div>

</div>`
}

/**
 * Abre una ventana nueva con los carnets listos para imprimir.
 * @param {Array<{ nombre, apellido, dni, nivel, grado, seccion, qr_token, qrBase64 }>} carnets
 */
export async function imprimirCarnets(carnets) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('Por favor permite ventanas emergentes en este sitio para imprimir.')
    return
  }

  // Mostrar mensaje de carga mientras se obtiene el logo
  win.document.write(`<!DOCTYPE html><html><body style="font-family:Arial;text-align:center;padding:40px;color:#555;">
    <p>Preparando carnets...</p></body></html>`)

  // Convertir logo a base64 para embeber en la ventana
  const logoBase64 = await urlToBase64(`${window.location.origin}/logo.png`)

  const fecha = new Date().toLocaleDateString('es-PE', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Carnets CEAUNE</title>
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
      margin-bottom: 7mm;
      padding-bottom: 3mm;
      border-bottom: 0.3mm solid #eee;
    }

    .grid-carnets {
      display: grid;
      grid-template-columns: repeat(2, 97mm);
      gap: 6mm;
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
    CEAUNE &mdash; ${carnets.length} carnet${carnets.length !== 1 ? 's' : ''} &mdash; ${esc(fecha)}
  </p>

  <div class="grid-carnets">
    ${carnets.map(c => `<div class="carnet-wrapper">${carnetHTML(c, logoBase64)}</div>`).join('\n    ')}
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
