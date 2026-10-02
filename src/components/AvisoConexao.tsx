import { useEffect, useState } from 'react'

const TEMPO_AVISO_VOLTOU_MS = 4_000

// Faixa no topo quando a internet cai (comum no campo) e aviso rápido quando volta
export default function AvisoConexao() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [voltou, setVoltou] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const aoCair = () => {
      setOnline(false)
      setVoltou(false)
    }
    const aoVoltar = () => {
      setOnline(true)
      setVoltou(true)
      clearTimeout(timer)
      timer = setTimeout(() => setVoltou(false), TEMPO_AVISO_VOLTOU_MS)
    }
    window.addEventListener('offline', aoCair)
    window.addEventListener('online', aoVoltar)
    return () => {
      window.removeEventListener('offline', aoCair)
      window.removeEventListener('online', aoVoltar)
      clearTimeout(timer)
    }
  }, [])

  if (!online) {
    return (
      <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-900">
        📡 Sem internet. O que você preencheu continua aqui; envie quando a conexão voltar.
      </div>
    )
  }
  if (voltou) {
    return (
      <div role="status" className="bg-folha-100 px-4 py-2 text-center text-sm font-semibold text-folha-800">
        ✅ Conexão de volta.
      </div>
    )
  }
  return null
}
