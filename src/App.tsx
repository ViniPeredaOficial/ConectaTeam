import { Route } from 'react-router'
import Layout from './components/Layout'
import RotaEquipe from './components/RotaEquipe'
import RotaProdutor from './components/RotaProdutor'
import Inicio from './pages/Inicio'
import NaoEncontrada from './pages/NaoEncontrada'
import NovoChamado from './pages/produtor/NovoChamado'
import MeusChamados from './pages/produtor/MeusChamados'
import Entrar from './pages/produtor/Entrar'
import Login from './pages/especialista/Login'
import Fila from './pages/especialista/Fila'
import Chamado from './pages/especialista/Chamado'
import LoginAdmin from './pages/admin/Login'
import PainelAdmin from './pages/admin/Painel'

// Rotas do app: área do produtor (mobile) e do especialista (desktop).
// Montadas com createBrowserRouter em main.tsx (permite o aviso ao sair com formulário preenchido).
export const rotas = (
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
    <Route element={<RotaEquipe papel="especialista" />}>
      <Route path="/especialista" element={<Fila />} />
      <Route path="/especialista/chamado/:id" element={<Chamado />} />
    </Route>
    <Route path="/admin/login" element={<LoginAdmin />} />
    {/* Só para perfis.papel = 'administrador' */}
    <Route element={<RotaEquipe papel="administrador" />}>
      <Route path="/admin" element={<PainelAdmin />} />
    </Route>
    <Route path="*" element={<NaoEncontrada />} />
  </Route>
)
