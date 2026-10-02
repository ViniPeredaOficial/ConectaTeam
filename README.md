# Radar de Pragas (ConectaTeam)

O produtor rural reporta uma praga com foto, cultura, descrição e localização. Uma IA faz a triagem com base no Agrofit/MAPA e um especialista confirma a sugestão antes de qualquer alerta regional.

**Stack:** React + Vite + TypeScript + Tailwind CSS, Supabase (Postgres, Auth, Storage, Edge Functions), Gemini e Telegram (chamados só nas Edge Functions). Hospedado no Vercel.

## Rodar localmente

Requisito: Node 20 ou mais recente.

```bash
npm install
cp .env.example .env     # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev              # abre em http://localhost:5173
```

Outros comandos: `npm run build` (gera o build de produção em `dist/`) e `npm run lint`.

> Nunca coloque no `.env` do front a service_role, a chave do Gemini ou o token do Telegram. Essas chaves ficam como secrets das Edge Functions.

## Estrutura

```
src/lib/                 cliente Supabase e constantes (fonte dos dados)
src/pages/produtor/      telas do produtor (mobile-first)
src/pages/especialista/  telas do especialista (desktop, com login)
src/components/          componentes compartilhados
src/types/               tipos do banco
supabase/migrations/     SQL versionado
supabase/functions/      Edge Functions (Deno)
scripts/                 scripts Python de dados
```

## Rotas

| Rota | Tela |
|---|---|
| `/` | Escolha: Sou produtor / Sou especialista |
| `/produtor` | Reportar praga |
| `/produtor/chamados` | Meus chamados |
| `/especialista/login` | Login do especialista |
| `/especialista` | Fila de chamados |
| `/especialista/chamado/:id` | Análise do chamado |

## Edge Function `triagem`

Recebe `POST { chamado_id }` e faz a triagem nesta ordem:
1. Confere que o chamado é de quem chamou.
2. Envia ao Gemini a foto, a descrição e a lista de pragas do Agrofit da cultura.
3. Descarta qualquer praga fora dessa lista.
4. Anexa até 10 produtos registrados por praga, com biológicos e orgânicos primeiro.
5. Grava o resultado em `sugestoes_ia`.

A função responde **202 na hora** e faz a triagem em segundo plano (`EdgeRuntime.waitUntil`). Quando a sugestão é gravada, a fila do especialista recebe a atualização pelo Realtime. Se o Gemini estiver sobrecarregado (503) ou passar de 45s, a função tenta o modelo principal mais uma vez e depois os modelos de `GEMINI_MODELOS_RESERVA`, tudo dentro de 2 minutos. Se todas as tentativas falharem, grava o campo `erro` com a lista de candidatas vazia, e o especialista segue sem a sugestão. Os logs mostram uma linha `tentativa` por modelo e uma linha `triagem` com o resultado final.

Com `{ "chamado_id": "...", "aguardar": true }`, a função espera o resultado e o devolve na resposta. O script de teste usa esse modo.

### Secrets e deploy (uma vez)

```bash
supabase login
supabase link --project-ref <ref-do-projeto>        # ref = trecho da URL https://<ref>.supabase.co
supabase secrets set GEMINI_API_KEY=<chave-do-ai-studio> GEMINI_MODEL=gemini-3.5-flash
supabase secrets set GEMINI_MODELOS_RESERVA=gemini-2.5-flash,gemini-3.1-flash-lite
supabase secrets set ALLOWED_ORIGINS=http://localhost:5173,https://<seu-app>.vercel.app
supabase functions deploy triagem --use-api          # --use-api dispensa o Docker
```

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já vêm automaticamente nas Edge Functions. A chave do Gemini é criada em https://aistudio.google.com/apikey.

### Testar

```bash
bash scripts/testar_triagem.sh caminho/da/foto.jpg Tomate "Folhas com furos e lagartas"
```

O script faz login anônimo, envia a foto, cria um chamado com `simulado = true` e chama a função. Os logs ficam no painel do Supabase, em Edge Functions → triagem → Logs.

Para medir a latência do Gemini direto da sua máquina, sem passar pelo Supabase, rode `GEMINI_API_KEY=<chave> node scripts/diagnosticar_gemini.mjs <foto.jpg>`.

### Dados de demonstração

[supabase/seed/demo.sql](supabase/seed/demo.sql) cria 7 chamados simulados com as sugestões da IA já gravadas. Eles cobrem um caso de IA confiante, um de IA em dúvida, um de foto ruim e um de IA fora do ar, e garantem a apresentação mesmo sem o Gemini. Antes de rodar, crie o usuário `produtor.demo@radardepragas.app` em Authentication → Users. Depois rode o arquivo no SQL Editor; ele pode ser executado de novo, porque apaga e recria a demo.

## Dados

| Base | Link | Extraído em | Uso |
|---|---|---|---|
| Agrofit: produtos formulados (MAPA) | https://dados.agricultura.gov.br/dataset/agrofit (arquivo `agrofitprodutosformulados.csv`) | 02/10/2026 | Tabelas `agrofit_pragas` e `agrofit_produtos` |
| Municípios brasileiros com coordenadas (dados do IBGE, compilados por kelvins) | https://github.com/kelvins/municipios-brasileiros | 02/10/2026 | Tabela `municipios` (só SP, 645 municípios) |

### Gerar e importar

```bash
python -m venv scripts/.venv
scripts/.venv/Scripts/pip install -r scripts/requirements.txt    # no Linux/Mac: scripts/.venv/bin/pip
# coloque o CSV do Agrofit em scripts/dados/ (essa pasta não vai para o git)
scripts/.venv/Scripts/python scripts/importar_agrofit.py
scripts/.venv/Scripts/python scripts/importar_municipios.py
```

Os arquivos saem em `scripts/saida/`. No Supabase, use Table Editor → tabela → Insert → *Import data from CSV*, importando primeiro `municipios.csv` e depois os dois do Agrofit.

As decisões de limpeza ficam configuráveis no topo de `importar_agrofit.py`:
- **Culturas**: só as da demo (tomate, café e alface). As variantes de tomate entram como "Tomate".
- **Plantas daninhas**: ficam fora (`INCLUIR_PLANTAS_DANINHAS = False`).
- **"Todas as culturas"**: os produtos entram só para pragas que já existem na cultura.
- **Orgânico e biológico**: orgânico é `ORGANICOS = SIM`. Biológico é quando a `CLASSE` contém "biológico" ou "microbiológico", ou quando o ingrediente é "Produto Microbiológico".
