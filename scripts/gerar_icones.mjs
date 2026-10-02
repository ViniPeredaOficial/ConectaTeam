// Gera os ícones PNG do PWA (radar branco sobre fundo verde) sem dependências externas.
// Uso: node scripts/gerar_icones.mjs   -> grava em public/icons/

import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const VERDE = [0x2f, 0x7d, 0x32] // folha-600, igual ao theme_color
const BRANCO = [0xff, 0xff, 0xff]
const SUPERAMOSTRAGEM = 4 // suaviza as bordas

// Desenho em coordenadas normalizadas (0 a 1). Tudo dentro de 80% do centro (área segura "maskable").
function corDoPonto(x, y) {
  const dx = x - 0.5
  const dy = y - 0.5
  const r = Math.hypot(dx, dy)
  const espessura = 0.022

  // Três anéis do radar
  for (const raio of [0.12, 0.22, 0.32]) if (Math.abs(r - raio) < espessura) return BRANCO
  // Ponto central
  if (r < 0.04) return BRANCO
  // "Varredura": linha do centro até o anel externo, a 45 graus
  const angulo = Math.atan2(-dy, dx)
  if (r < 0.32 && Math.abs(angulo - Math.PI / 4) < espessura / Math.max(r, 0.01)) return BRANCO
  // Praga detectada: ponto no segundo anel
  if (Math.hypot(dx - 0.13, dy + 0.06) < 0.035) return BRANCO
  return VERDE
}

function desenhar(tamanho) {
  const pixels = Buffer.alloc(tamanho * (tamanho * 3 + 1)) // +1 byte de filtro por linha
  for (let py = 0; py < tamanho; py++) {
    const inicioLinha = py * (tamanho * 3 + 1)
    pixels[inicioLinha] = 0 // filtro "None"
    for (let px = 0; px < tamanho; px++) {
      const soma = [0, 0, 0]
      for (let sy = 0; sy < SUPERAMOSTRAGEM; sy++) {
        for (let sx = 0; sx < SUPERAMOSTRAGEM; sx++) {
          const cor = corDoPonto(
            (px + (sx + 0.5) / SUPERAMOSTRAGEM) / tamanho,
            (py + (sy + 0.5) / SUPERAMOSTRAGEM) / tamanho,
          )
          for (let c = 0; c < 3; c++) soma[c] += cor[c]
        }
      }
      const n = SUPERAMOSTRAGEM * SUPERAMOSTRAGEM
      for (let c = 0; c < 3; c++) pixels[inicioLinha + 1 + px * 3 + c] = Math.round(soma[c] / n)
    }
  }
  return pixels
}

// --- Codificação PNG mínima (RGB, 8 bits) ---
const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let c = 0xffffffff
  for (const byte of buffer) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function bloco(tipo, dados) {
  const tamanho = Buffer.alloc(4)
  tamanho.writeUInt32BE(dados.length)
  const tipoEDados = Buffer.concat([Buffer.from(tipo, 'ascii'), dados])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(tipoEDados))
  return Buffer.concat([tamanho, tipoEDados, crc])
}

function png(tamanho) {
  const cabecalho = Buffer.alloc(13)
  cabecalho.writeUInt32BE(tamanho, 0)
  cabecalho.writeUInt32BE(tamanho, 4)
  cabecalho[8] = 8 // bits por canal
  cabecalho[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', cabecalho),
    bloco('IDAT', deflateSync(desenhar(tamanho), { level: 9 })),
    bloco('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const [nome, tamanho] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  writeFileSync(`public/icons/${nome}`, png(tamanho))
  console.log(`public/icons/${nome} (${tamanho}x${tamanho})`)
}
