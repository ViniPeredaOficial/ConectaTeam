// Recompressão da foto no navegador antes do upload (regra 5).
//
// Por que isso remove EXIF/GPS: o <canvas> guarda só os pixels. Ao gerar um JPEG novo
// a partir dele, os metadados do arquivo original (EXIF, coordenadas GPS, modelo do
// celular, data) não são copiados. O arquivo enviado nunca é o original.

const LADO_MAIOR = 1280
const QUALIDADE = 0.8

export async function recomprimirFoto(arquivo: File): Promise<Blob> {
  let bitmap: ImageBitmap
  try {
    // "from-image" aplica a rotação do EXIF antes de descartá-lo (foto não sai deitada)
    bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('Não foi possível abrir esta foto. Tente tirar outra pela câmera.')
  }

  const escala = Math.min(1, LADO_MAIOR / Math.max(bitmap.width, bitmap.height))
  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Seu navegador não conseguiu processar a foto.')
  ctx.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao preparar a foto.'))),
      'image/jpeg',
      QUALIDADE,
    )
  })
}
