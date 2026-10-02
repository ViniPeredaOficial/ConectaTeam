// Limpeza do texto do ditado por voz (Web Speech API).

const semAcento = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

// O Chrome do Android entrega a frase ACUMULADA a cada palavra ("Alface", "Alface com",
// "Alface com manchas"...), cada uma como resultado final. Aqui, um trecho que é começo
// de outro é substituído pelo maior, e trechos repetidos são descartados.
export function removerRepeticoes(trechos: string[]): string {
  const saida: string[] = []
  for (const bruto of trechos) {
    const trecho = bruto.trim()
    if (!trecho) continue
    const atual = semAcento(trecho)
    const ultimo = saida.length ? semAcento(saida[saida.length - 1]) : null
    if (ultimo !== null && atual.startsWith(ultimo)) saida[saida.length - 1] = trecho // versão maior
    else if (ultimo !== null && ultimo.startsWith(atual)) continue // versão menor ou igual
    else saida.push(trecho)
  }
  return saida.join(' ')
}

// Palavras comuns na descrição de pragas: ajudam a escolher entre as interpretações do navegador
// (ex.: "alface com manchas verdes" em vez de "alface com músicas verdes")
const VOCABULARIO = new Set(
  (
    'mancha manchas folha folhas fruto frutos lagarta lagartas praga pragas furo furos furado furada furadas ' +
    'mofo po amarela amarelas amarelada amareladas amarelado amarelo marrom marrons escura escuras preta pretas ' +
    'seca secas seco murcha murchas murchando umida umidas umido podre podres podridao inseto insetos bicho ' +
    'bichos pulgao pulgoes mosca moscas mosquinha mosquinhas branca brancas broca ferrugem mildio verde verdes ' +
    'clara claras claro caule raiz raizes tomate cafe alface planta plantas pinta pintas bolinha bolinhas teia ' +
    'acaro acaros galeria galerias mina minas buraco buracos lesao lesoes enrolada enroladas enrugada enrugadas ' +
    'queimada queimadas ovo ovos casca cascas broto brotos flor flores'
  ).split(' '),
)

function pontos(frase: string): number {
  return semAcento(frase)
    .split(/[^a-z]+/)
    .filter((palavra) => VOCABULARIO.has(palavra)).length
}

// Entre as alternativas do reconhecimento, fica a com mais palavras do campo (empate: a primeira)
export function escolherAlternativa(alternativas: string[]): string {
  let melhor = alternativas[0] ?? ''
  let melhorPontos = pontos(melhor)
  for (const alternativa of alternativas.slice(1)) {
    const p = pontos(alternativa)
    if (p > melhorPontos) {
      melhor = alternativa
      melhorPontos = p
    }
  }
  return melhor
}
