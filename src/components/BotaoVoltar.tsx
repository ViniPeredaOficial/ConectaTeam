import { useNavigate } from 'react-router'

type Props = {
  para: string // destino quando não há página anterior do site (ex.: entrou direto pelo link)
  rotulo?: string
}

// "← Voltar": volta para a página anterior do próprio site; sem histórico, vai para "para"
export default function BotaoVoltar({ para, rotulo = 'Voltar' }: Props) {
  const navegar = useNavigate()

  function voltar() {
    // O React Router guarda a posição no histórico em history.state.idx (0 = primeira página do site)
    const posicao = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (posicao > 0) navegar(-1)
    else navegar(para)
  }

  return (
    <button
      type="button"
      onClick={voltar}
      className="flex min-h-10 items-center gap-1 self-start font-semibold text-folha-700 hover:underline"
    >
      <span aria-hidden="true">←</span> {rotulo}
    </button>
  )
}
