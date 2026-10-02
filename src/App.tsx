import { Route, Routes } from 'react-router'
import Layout from './components/Layout'
import RotaEspecialista from './components/RotaEspecialista'
import RotaProdutor from './components/RotaProdutor'
import Inicio from './pages/Inicio'
import NovoChamado from './pages/produtor/NovoChamado'
import MeusChamados from './pages/produtor/MeusChamados'
import Entrar from './pages/produtor/Entrar'
import Login from './pages/especialista/Login'
import Fila from './pages/especialista/Fila'
import Chamado from './pages/especialista/Chamado'

// Rotas do app: área do produtor (mobile) e do especialista (desktop)
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Inicio />} />
        <Route path="/produtor/entrar" element={<Entrar />} />
        {/* Só com conta de produtor (celular + senha) */}
        <Route element={<RotaProdutor />}>
          <Route path="/produtor" element={<NovoChamado />} />
          <Route path="/produtor/chamados" element={<MeusChamados />} />
        </Route>
        <Route path="/especialista/login" element={<Login />} />
        {/* Só para perfis.papel = 'especialista' */}
        <Route element={<RotaEspecialista />}>
          <Route path="/especialista" element={<Fila />} />
          <Route path="/especialista/chamado/:id" element={<Chamado />} />
        </Route>
        <Route path="*" element={<p className="text-center">Página não encontrada.</p>} />
      </Route>
    </Routes>
  )
}
