import { useEffect } from 'react'

const NOME = 'Radar de Pragas'

// Título da aba do navegador por tela (ex.: "Meus chamados · Radar de Pragas")
export function useTitulo(titulo?: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${NOME}` : NOME
  }, [titulo])
}
