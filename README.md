# 🌱 Radar de Pragas

**Protótipo:** https://conectateam.vercel.app · **Repositório:** https://github.com/ViniPeredaOficial/ConectaTeam
**Canal de alertas:** [t.me/radardepragas_araraquara](https://t.me/radardepragas_araraquara) · **Bot de inscrição:** [t.me/ConectaTeamBot](https://t.me/ConectaTeamBot)

<img src="public/qr-canal-telegram.png" alt="QR code do canal de alertas no Telegram" width="160" />

## O problema

O pequeno produtor costuma descobrir uma praga quando o estrago já começou. Ele raramente tem um agrônomo por perto para dizer o que é e o que fazer. E os vizinhos só ficam sabendo quando a praga chega na lavoura deles.

## A solução

O produtor tira uma foto pelo celular, sem instalar app e sem cadastro. Uma IA faz a **triagem** usando a base oficial **Agrofit/MAPA**, e um **especialista humano confirma** a resposta. Só depois da confirmação sai um **alerta regional no Telegram** para os produtores da região. Cada resposta também fica salva como **dado rotulado** (IA × especialista), base para treinar modelos melhores no futuro.

## Como funciona (5 passos)

1. **O produtor reporta.** Envia foto, cultura, o que viu e o município. A foto é recomprimida no próprio celular, o que remove o EXIF e o GPS.
2. **A IA faz a triagem.** O Gemini sugere de 1 a 3 pragas, **só da lista do Agrofit** para aquela cultura, cada uma com nível de confiança e os produtos registrados.
3. **O especialista decide.** Na fila, que atualiza ao vivo, ele confirma ou corrige a praga, escreve como identificar e o manejo (**sem dose**) e escolhe a imagem do alerta.
4. **O alerta sai.** Vai para o canal da região e para os inscritos do bot num raio de 15 km, **sempre** terminando com "Procure a assistência técnica (CATI) antes de aplicar qualquer produto."
5. **Todos ficam sabendo.** O produtor vê a resposta na tela "Meus chamados", o mapa público mostra os alertas por município e o par IA × especialista fica registrado.

## Stack

- **Front:** React + Vite + TypeScript + Tailwind CSS, hospedado no Vercel. O produtor usa no celular, como PWA leve; o especialista usa no desktop.
- **Backend:** Supabase no plano gratuito (Postgres com RLS, Auth, Storage, Realtime e Edge Functions em Deno).
- **IA:** Google Gemini no plano gratuito, chamado **só** dentro da Edge Function `triagem`.
- **Alertas:** Telegram Bot API, chamada **só** dentro das Edge Functions `alerta` e `telegram-webhook`.
- **Mapa:** react-leaflet com OpenStreetMap.

## Como rodar

```bash
npm install
cp .env.example .env     # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (só chaves públicas)
npm run dev              # http://localhost:5173
```

Para montar o backend do zero, nesta ordem:
1. Aplique as migrations de [supabase/migrations/](supabase/migrations/) em ordem no SQL Editor.
2. Importe os CSVs de `scripts/saida/` (veja [Dados](#dados)).
3. Publique as Edge Functions e cadastre os secrets (veja [Edge Function `triagem`](#edge-function-triagem) e [Alertas no Telegram](#alertas-no-telegram)).
4. Crie um usuário especialista: crie o usuário no Auth e rode `update perfis set papel = 'especialista' ...` no SQL Editor.
5. (Opcional) Rode [supabase/seed/demo.sql](supabase/seed/demo.sql) para ter dados de demonstração.

## Fontes de dados e licenças

| Base | Link | Extraído em | Licença |
|---|---|---|---|
| Agrofit: produtos formulados (MAPA) | https://dados.agricultura.gov.br/dataset/agrofit | 02/10/2026 | CC-BY, conforme o portal de dados abertos do MAPA (a confirmar na página do conjunto) |
| Municípios com coordenadas (dados do IBGE) | https://github.com/kelvins/municipios-brasileiros | 02/10/2026 | MIT |
| Mapa base | https://www.openstreetmap.org | ao vivo | Dados © colaboradores do OpenStreetMap, sob ODbL. Os tiles exigem atribuição, que aparece no mapa |
| Leaflet / react-leaflet | https://leafletjs.com | — | BSD-2-Clause / Hippocratic |

Toda tela mostra a frase "Fonte: Agrofit/MAPA, dados.agricultura.gov.br, extraído em 02/10/2026".

## Ética e privacidade

- **A IA não diagnostica, faz triagem.** Ela só pode sugerir pragas que existem no Agrofit para a cultura, e o servidor descarta qualquer resposta fora da lista. **Nada vira alerta sem um especialista humano.**
- **Nunca sai dose.** O formulário do especialista e a função `alerta` bloqueiam textos com padrões de dose (L/ha, mL, kg/ha…). O alerta mostra só o nome comercial dos produtos registrados, sem concentração, e sempre manda procurar a CATI. Um CHECK no banco impede gravar um alerta sem o aviso.
- **A localização do produtor é protegida.**
  - A coordenada exata fica numa tabela separada, que o especialista não acessa por RLS.
  - Telas, mapa e alertas mostram só o **município**, e o mapa usa o centroide dele.
  - A foto é recomprimida no navegador, o que remove EXIF e GPS. Isso foi testado com uma foto de 3000×2000 com GPS no EXIF: a saída não tinha EXIF nem GPS.
- **Dados mínimos.** O produtor entra sem cadastro (login anônimo), e o nome é opcional. Não pedimos CPF, telefone nem e-mail. Os logs das Edge Functions não registram dados pessoais nem `chat_id`.
- **Nenhuma chave secreta no front.** Gemini, Telegram e `service_role` existem só como secrets das Edge Functions. A auditoria confirmou que o bundle de produção tem só a anon key e que nenhuma chave aparece no código nem no histórico do git.
- **Dado simulado é sempre marcado.** Ele tem `simulado = true` no banco, o selo "simulado" em toda tela e "🧪 SIMULADO" no texto do alerta. Alertas simulados nunca são enviados ao canal real.
- **Atenção ao plano gratuito do Gemini.** Pelos termos do Google, o conteúdo enviado no plano gratuito pode ser usado para melhorar os produtos deles. Por isso a foto vai sem metadados e a descrição não deve conter dados pessoais. Em produção, o caminho é o plano pago ou um modelo próprio.

## Limitações conhecidas

- **A IA gratuita é lenta e instável.** Medimos de 28 a mais de 60 segundos, com erros 503 de sobrecarga. A triagem roda em segundo plano, tenta de novo e usa modelos reserva; se tudo falhar, o especialista segue sem a sugestão.
- **Cobertura da demo:** só tomate, café e alface, só municípios de SP e só pragas e doenças (plantas daninhas ficaram de fora).
- **O raio do alerta é aproximado**, porque é calculado entre centroides de municípios. Em municípios grandes, ele pode incluir ou excluir vizinhos de forma imprecisa.
- **A trava de dose é por padrões de texto.** Ela é conservadora (pode bloquear algo legítimo) e não pega dose por extenso, como "dois litros". A revisão do especialista continua essencial.
- **O histórico do produtor fica no navegador**, por causa do login anônimo. Não há notificação push: a resposta aparece com a tela aberta, e o alerta regional chega pelo Telegram.
- **Especialistas são cadastrados manualmente** pelo SQL Editor.

## Próximos passos

- **App nativo off-line:** fotografar sem sinal na lavoura e enviar quando houver conexão.
- **WhatsApp:** o canal mais usado no campo, para reportar e para receber alertas.
- **Modelo próprio de visão computacional,** treinado com os pares rotulados IA × especialista que o sistema já grava.
- **Parceria com a CATI:** extensionistas como especialistas, com um fluxo oficial de atendimento e ampliação para outras regiões e culturas.

---

# Guia técnico

## Fluxo de branches

```
branch de trabalho (criada a partir de develop) → PR → develop → PR → staging → PR → main
```

- Não é possível dar push direto em `main`, `staging` ou `develop`, e ninguém pode apagar essas branches ou fazer force push nelas. A regra fica no ruleset "Fluxo protegido" do GitHub.
- Todo PR precisa da aprovação de @ViniPeredaOficial, definido em [.github/CODEOWNERS](.github/CODEOWNERS).
- O check `fluxo` ([.github/workflows/fluxo-de-branches.yml](.github/workflows/fluxo-de-branches.yml)) recusa PRs fora da ordem, por exemplo de uma feature direto para `main`.

Para começar uma tarefa:
```bash
git checkout develop && git pull
git checkout -b feat/minha-tarefa
# ...commits...
git push -u origin feat/minha-tarefa   # depois abra o PR para develop
```

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

[supabase/seed/demo.sql](supabase/seed/demo.sql) cria, na **região de Araraquara**, 15 chamados espalhados pelas últimas 3 semanas:
- **8 analisados com alerta**. A IA acerta 6 deles, para a taxa de acerto do painel ter um valor real de exemplo.
- **5 em análise**. Entre eles há um com a IA fora do ar e outro com foto ruim.
- **2 descartados**.

Sobre o conteúdo:
- Todos os registros têm `simulado = true` e aparecem com o selo "simulado".
- As pragas e os produtos vêm do Agrofit. Só a confiança da IA e os textos são simulados.
- Os chamados **não têm imagens**, o que elimina o risco de licença e de fotos de pessoas.
- Os alertas simulados **não são enviados ao Telegram**.

**Rodar**: é preciso ter pelo menos um usuário especialista. Abra o SQL Editor, cole o arquivo e clique em Run. O seed pode ser executado de novo, porque apaga e recria a demo. Se existir o usuário `produtor.demo@radardepragas.app`, ele vira o autor dos chamados; senão, o especialista assume esse papel.

**Limpar**: rode [supabase/seed/limpar_demo.sql](supabase/seed/limpar_demo.sql) no SQL Editor. Ele apaga tudo com `simulado = true`, e sugestões, validações, localizações e alertas vão junto em cascata.

## Mapa de alertas

O componente [MapaAlertas](src/components/MapaAlertas.tsx) usa react-leaflet com tiles do OpenStreetMap, com atribuição visível. Ele aparece em dois lugares: na tela inicial `/`, como visão pública, e na aba "Mapa de alertas" do painel do especialista.

Como ele desenha os dados:
- **Um círculo por município** com alerta nos últimos 30 dias, posicionado no **centroide do município**, nunca no ponto do produtor.
- O tamanho do círculo segue o número de alertas, e a cor segue a praga predominante.
- O popup mostra praga, cultura, data e o selo "simulado".
- Há filtros por cultura e por período (7, 15 ou 30 dias).

O mapa lê só tabelas públicas (`alertas` e `municipios`). Para não pesar a tela do produtor, o Leaflet só é baixado quando o mapa aparece.

## Alertas no Telegram

### Função `alerta`

O especialista confirma o chamado e o painel chama `POST { validacao_id }`. Só usuários com papel `especialista` têm acesso. A função:
1. Calcula os municípios num raio de 15 km (configurável em `ALERTA_RAIO_KM`), usando os **centroides** dos municípios e nunca a coordenada do produtor.
2. Monta a mensagem: praga, região, cultura, como identificar, manejo e até 5 produtos do Agrofit, com os biológicos primeiro.
3. Envia ao canal da região e aos inscritos desses municípios.
4. Grava o resultado em `alertas`.

Regras de segurança da mensagem:
- Uma trava no servidor recusa textos com dose (por exemplo "2 L/ha" ou "300 mL").
- A mensagem **sempre termina** com o aviso da CATI.
- Dados simulados saem marcados com "🧪 SIMULADO".
- Cada validação gera no máximo um alerta.

### Função `telegram-webhook`

É o cadastro de inscritos pelo bot:
- `/start` mostra botões com as cidades até 40 km de Araraquara, ou o produtor digita o nome da cidade.
- `/sair` remove a inscrição.

O Telegram não envia JWT, então a função é publicada com `verify_jwt = false` (veja [supabase/config.toml](supabase/config.toml)). Em troca, ela só aceita requisições com o header `X-Telegram-Bot-Api-Secret-Token` correto.

### Configurar (uma vez)

1. Crie o bot no **@BotFather** e guarde o token.
2. Crie o canal público "Radar de Pragas · Região de Araraquara" e adicione o bot como **administrador**.
3. Cadastre os secrets e publique as funções:
   ```bash
   SEGREDO=$(openssl rand -hex 32); echo "$SEGREDO"   # guarde este valor: ele é usado no passo 4
   supabase secrets set TELEGRAM_BOT_TOKEN=<token> TELEGRAM_CANAL_ID=@<nome_do_canal> TELEGRAM_WEBHOOK_SECRET=$SEGREDO
   # opcionais: ALERTA_RAIO_KM=15 TELEGRAM_REGIAO_COD=3503208 TELEGRAM_REGIAO_RAIO_KM=40
   supabase functions deploy alerta --use-api
   supabase functions deploy telegram-webhook --use-api --no-verify-jwt
   ```
4. Aponte o webhook do bot para a função, com o **mesmo** `secret_token`:
   ```bash
   curl -s "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<ref-do-projeto>.supabase.co/functions/v1/telegram-webhook" \
     -d "secret_token=$SEGREDO" \
     -d 'allowed_updates=["message","callback_query"]'
   ```
   Para conferir: `curl -s "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`.

Rode os passos 3 e 4 no mesmo terminal, porque o `$SEGREDO` só existe nele. O `supabase secrets list` mostra apenas um hash do valor.

### Testes da mensagem

```bash
deno test supabase/functions/alerta/mensagem_test.ts
```

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
