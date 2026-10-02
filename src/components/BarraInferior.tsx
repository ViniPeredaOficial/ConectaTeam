import { NavLink } from 'react-router'

const ITENS = [
  { para: '/', icone: '🏠', rotulo: 'Início' },
  { para: '/produtor', icone: '📷', rotulo: 'Reportar' },
  { para: '/produtor/chamados', icone: '📋', rotulo: 'Meus chamados' },
]

// Navegação do produtor no celular, como num app (some em telas grandes)
export default function BarraInferior() {
  return (
    <nav aria-label="Navegação principal" className="border-t border-folha-200 bg-white md:hidden">
      <ul className="grid grid-cols-3">
        {ITENS.map((item) => (
          <li key={item.para}>
            <NavLink
              to={item.para}
              end
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  isActive ? 'text-folha-700' : 'text-gray-500'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`rounded-full px-4 py-0.5 text-xl ${isActive ? 'bg-folha-100' : ''}`}
                  >
                    {item.icone}
                  </span>
                  {item.rotulo}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
