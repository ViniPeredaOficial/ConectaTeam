import type { ButtonHTMLAttributes } from 'react'
import { Link } from 'react-router'

// Estilos do botão grande (mínimo 48px de altura), pensado para uso no celular
const estilos = {
  primario: 'bg-folha-600 text-white hover:bg-folha-700 active:bg-folha-800',
  secundario: 'bg-white text-folha-700 border-2 border-folha-600 hover:bg-folha-100',
}
const base =
  'flex min-h-12 w-full items-center justify-center rounded-xl px-6 py-3 ' +
  'text-lg font-semibold shadow disabled:opacity-50'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  to?: string
  variante?: keyof typeof estilos
}

// Se receber "to", vira um link de navegação; senão, um botão comum
export default function BotaoGrande({ to, variante = 'primario', children, ...resto }: Props) {
  const classes = `${base} ${estilos[variante]}`
  if (to) {
    return (
      <Link to={to} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <button className={classes} {...resto}>
      {children}
    </button>
  )
}
