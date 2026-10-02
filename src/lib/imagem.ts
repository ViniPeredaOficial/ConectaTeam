// Recompressão da foto no navegador antes do upload (regra 5).
//
// Por que isso remove EXIF/GPS: o <canvas> guarda só os pixels. Ao gerar um JPEG novo
// a partir dele, os metadados do arquivo original (EXIF, coordenadas GPS, modelo do
// celular, data) não são copiados. O arquivo enviado nunca é o original.

const LADO_MAIOR = 1280
const QUALIDADE = 0.8

// Área de recorte em proporção da imagem (0 a 1)
export type Recorte = { x: number; y: number; largura: number; altura: number }

export function recomprimirFoto(arquivo: Blob): Promise<Blob> {
  return recortarFoto(arquivo, null)
}

// Recorta (opcional) e recomprime. Sem recorte, usa a imagem inteira.
export async function recortarFoto(arquivo: Blob, recorte: Recorte | null): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    // "from-image" aplica a rotação do EXIF antes de descartá-lo (foto não sai deitada)
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Não foi possível abrir esta foto. Tente tirar outra pela câmera.')
  }

  const area = recorte ?? { x: 0, y: 0, largura: 1, altura: 1 }
  const origemX = area.x * bitmap.width
  const origemY = area.y * bitmap.height
  const origemL = area.largura * bitmap.width
  const origemA = area.altura * bitmap.height

  const escala = Math.min(1, LADO_MAIOR / Math.max(origemL, origemA))
  const largura = Math.max(1, Math.round(origemL * escala))
  const altura = Math.max(1, Math.round(origemA * escala))

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não conseguiu processar a foto.')
  ctx.drawImage(bitmap, origemX, origemY, origemL, origemA, 0, 0, largura, altura)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao preparar a foto.'))),
      'image/jpeg',
      QUALIDADE,
    )
  })
}
