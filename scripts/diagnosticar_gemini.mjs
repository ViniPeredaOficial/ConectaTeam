// Mede o tempo de resposta do Gemini em várias configurações, direto da máquina local,
// para descobrir o que deixa a triagem lenta. Não grava nada no Supabase.
//
// Uso (Git Bash), na raiz do projeto:
//   GEMINI_API_KEY=<sua-chave> node scripts/diagnosticar_gemini.mjs scripts/dados/tomate.jpg
// A chave fica só na variável do terminal: não é salva em arquivo.

import { readFileSync } from 'node:fs'

const CHAVE = process.env.GEMINI_API_KEY
const FOTO = process.argv[2]
const CULTURA = process.argv[3] ?? 'Tomate'
const TIMEOUT_MS = 60_000 // folga para medir mesmo os casos lentos

if (!CHAVE || !FOTO) {
  console.error('Uso: GEMINI_API_KEY=<chave> node scripts/diagnosticar_gemini.mjs <foto.jpg> [Cultura]')
  process.exit(1)
}

// Lê a lista de pragas da cultura do CSV gerado pelo importar_agrofit.py
function lerPragas() {
  const linhas = readFileSync('scripts/saida/agrofit_pragas.csv', 'utf8').trim().split(/\r?\n/).slice(1)
  // Divide por vírgula respeitando campos entre aspas
  const campos = (l) => [...l.matchAll(/("([^"]|"")*"|[^,]*)(,|$)/g)].map((m) => m[1].replace(/^"|"$/g, '').replace(/""/g, '"'))
  return linhas
    .map(campos)
    .filter((c) => c[0] === CULTURA)
    .map((c) => ({ comum: c[2], cientifico: c[3] }))
}

const pragas = lerPragas()
const foto = readFileSync(FOTO).toString('base64')
const lista = pragas.map((p) => `- ${p.cientifico} (${p.comum})`).join('\n')
const texto = `Cultura: ${CULTURA}\nDescrição do produtor: Folhas com furos e lagartas\n\nLista de pragas permitidas (Agrofit/MAPA):\n${lista}`

const schema = (comEnum) => ({
  type: 'OBJECT',
  properties: {
    candidatas: {
      type: 'ARRAY',
      maxItems: 3,
      items: {
        type: 'OBJECT',
        properties: {
          praga_nome_cientifico: comEnum
            ? { type: 'STRING', format: 'enum', enum: pragas.map((p) => p.cientifico) }
            : { type: 'STRING' },
          confianca: { type: 'NUMBER' },
          justificativa: { type: 'STRING' },
        },
        required: ['praga_nome_cientifico', 'confianca', 'justificativa'],
      },
    },
    observacao: { type: 'STRING' },
  },
  required: ['candidatas'],
})

// Cada teste: nome, modelo e o corpo da requisição
const testes = [
  ['texto curto, sem foto (latência base)', 'gemini-3.5-flash', {
    contents: [{ parts: [{ text: 'Responda apenas: OK' }] }],
  }],
  ['completo, sem ajuste de thinking', 'gemini-3.5-flash', {
    contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: foto } }, { text: texto }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema(true) },
  }],
  ['completo, thinking low (igual à função)', 'gemini-3.5-flash', {
    contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: foto } }, { text: texto }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema(true), thinkingConfig: { thinkingLevel: 'low' }, mediaResolution: 'MEDIA_RESOLUTION_MEDIUM' },
  }],
  ['completo, thinking minimal', 'gemini-3.5-flash', {
    contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: foto } }, { text: texto }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema(true), thinkingConfig: { thinkingLevel: 'minimal' } },
  }],
  ['completo, thinking low, SEM enum no schema', 'gemini-3.5-flash', {
    contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: foto } }, { text: texto }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema(false), thinkingConfig: { thinkingLevel: 'low' } },
  }],
  ['completo, modelo flash-lite', 'gemini-3.5-flash-lite', {
    contents: [{ parts: [{ inlineData: { mimeType: 'image/jpeg', data: foto } }, { text: texto }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema(true) },
  }],
]

console.log(`Cultura: ${CULTURA} | ${pragas.length} pragas na lista | foto ${Math.round(foto.length * 0.75 / 1024)} KB\n`)

for (const [nome, modelo, corpo] of testes) {
  const inicio = Date.now()
  let resumo
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CHAVE },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const json = await r.json()
    if (!r.ok) {
      resumo = `HTTP ${r.status}: ${json?.error?.message?.slice(0, 200)}`
    } else {
      const uso = json.usageMetadata ?? {}
      const saida = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      resumo = `ok | tokens: entrada ${uso.promptTokenCount}, thinking ${uso.thoughtsTokenCount ?? 0}, saída ${uso.candidatesTokenCount} | ${saida.replace(/\s+/g, ' ').slice(0, 120)}`
    }
  } catch (e) {
    resumo = e.name === 'TimeoutError' ? 'TIMEOUT (60s)' : e.message
  }
  console.log(`${String(Date.now() - inicio).padStart(6)} ms  ${nome}\n          ${resumo}\n`)
}
