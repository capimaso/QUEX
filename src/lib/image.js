// Prepara a foto de perfil no navegador antes de enviar:
// corta quadrado no centro, reduz pra no máx. 512px e converte pra JPEG (~50-150 KB).
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
export const AVATAR_ACCEPT = ACCEPTED.join(',')
export const AVATAR_MAX_INPUT_MB = 8

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }) } catch { /* cai no <img> */ }
  }
  const url = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Não deu pra abrir essa imagem.'))
      img.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}

export async function compressAvatar(file, { size = 512, quality = 0.85 } = {}) {
  if (!file || !ACCEPTED.includes(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.')
  if (file.size > AVATAR_MAX_INPUT_MB * 1024 * 1024) throw new Error(`A imagem é grande demais (máx. ${AVATAR_MAX_INPUT_MB} MB).`)
  const image = await decode(file)
  const w = image.width || image.naturalWidth
  const h = image.height || image.naturalHeight
  const side = Math.min(w, h)
  const out = Math.min(size, side)
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // PNG transparente vira fundo branco no JPEG
  ctx.fillRect(0, 0, out, out)
  ctx.drawImage(image, (w - side) / 2, (h - side) / 2, side, side, 0, 0, out, out)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Não deu pra processar essa imagem.')
  return blob
}

// Foto de produto: NÃO corta. Só reduz pra no máx. `max` px no lado maior e converte pra JPEG.
export async function compressPhoto(file, { max = 1280, quality = 0.82 } = {}) {
  if (!file || !ACCEPTED.includes(file.type)) throw new Error('Use uma imagem JPG, PNG ou WebP.')
  if (file.size > AVATAR_MAX_INPUT_MB * 1024 * 1024) throw new Error(`A imagem é grande demais (máx. ${AVATAR_MAX_INPUT_MB} MB).`)
  const image = await decode(file)
  const w = image.width || image.naturalWidth
  const h = image.height || image.naturalHeight
  const scale = Math.min(1, max / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cw, ch)
  ctx.drawImage(image, 0, 0, cw, ch)
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('Não deu pra processar essa imagem.')
  return blob
}
