// Trava de dose (regra 4) no servidor.
// MANTER IGUAL a src/lib/dose.ts (o front bloqueia antes; aqui é a garantia final).

const PADROES = [
  // 2 L/ha, 1,5 kg/ha, 300 mL/100 L, 20 g por planta, 5 cc/litro
  /\d+(?:[.,]\d+)?\s*(?:m?l|litros?|mililitros?|g|gramas?|kg|quilos?|cc)\s*(?:\/|por|a cada)\s*(?:ha|hectares?|alqueires?|\d*\s*l\b|litros?|plantas?|covas?|p[ée]s?|m2|m²)/i,
  // 2 litros, 500 mL, 30 g, 1 kg (qualquer quantidade com unidade de volume ou massa)
  /\d+(?:[.,]\d+)?\s*(?:ml|mililitros?|litros?|l\b|g\b|gramas?|kg|quilos?|cc\b)/i,
]

// Devolve o trecho que parece dose, ou null se o texto estiver ok
export function trechoComDose(texto: string): string | null {
  for (const padrao of PADROES) {
    const achado = texto.match(padrao)
    if (achado) return achado[0]
  }
  return null
}
