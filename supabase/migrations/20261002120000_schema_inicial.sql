-- =====================================================================
-- Radar de Pragas: schema inicial
-- Tabelas, RLS, view da fila, trigger de perfis, Storage e Realtime.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- Perfil de cada usuário do Auth (inclusive anônimos). O papel só muda via SQL Editor.
create table public.perfis (
  id        uuid primary key references auth.users (id) on delete cascade,
  papel     text not null default 'produtor' check (papel in ('produtor', 'especialista')),
  nome      text,
  criado_em timestamptz not null default now()
);

-- Municípios do IBGE (populada no próximo passo)
create table public.municipios (
  cod_ibge integer primary key,
  nome     text not null,
  uf       char(2) not null,
  lat      double precision not null,
  lon      double precision not null
);

-- Pragas registradas no Agrofit por cultura (estrutura provisória)
create table public.agrofit_pragas (
  id                    bigint generated always as identity primary key,
  cultura               text not null,
  praga_nome_comum      text,
  praga_nome_cientifico text not null
);
create index agrofit_pragas_cultura_idx on public.agrofit_pragas (cultura);

-- Produtos registrados no Agrofit (estrutura provisória: ajustar após inspecionar o CSV)
create table public.agrofit_produtos (
  id                    bigint generated always as identity primary key,
  cultura               text not null,
  praga_nome_cientifico text not null,
  marca_comercial       text not null,
  ingrediente_ativo     text,
  classe_toxicologica   text,
  organico              boolean not null default false,
  biologico             boolean not null default false
);
create index agrofit_produtos_cultura_praga_idx
  on public.agrofit_produtos (cultura, praga_nome_cientifico);

-- Chamado aberto pelo produtor. NÃO guarda coordenada (ver chamados_localizacao).
create table public.chamados (
  id            uuid primary key default gen_random_uuid(),
  produtor_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cultura       text not null,
  descricao     text check (char_length(descricao) <= 500),
  foto_path     text,
  municipio_cod integer references public.municipios (cod_ibge),
  status        text not null default 'em_analise'
                check (status in ('em_analise', 'analisado', 'descartado')),
  simulado      boolean not null default false,
  criado_em     timestamptz not null default now()
);
create index chamados_status_idx on public.chamados (status, criado_em desc);
create index chamados_produtor_idx on public.chamados (produtor_id);

-- Coordenada exata, separada para nunca chegar ao especialista
create table public.chamados_localizacao (
  chamado_id uuid primary key references public.chamados (id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lon        double precision not null check (lon between -180 and 180)
);

-- Triagem da IA. candidatas = [{praga_nome_comum, praga_nome_cientifico, confianca, justificativa, produtos}]
create table public.sugestoes_ia (
  id         uuid primary key default gen_random_uuid(),
  chamado_id uuid not null references public.chamados (id) on delete cascade,
  candidatas jsonb not null default '[]'::jsonb check (jsonb_typeof(candidatas) = 'array'),
  modelo     text,
  erro       text,  -- nulo quando a triagem deu certo
  criado_em  timestamptz not null default now()
);
create index sugestoes_ia_chamado_idx on public.sugestoes_ia (chamado_id, criado_em desc);

-- Resposta do especialista (par rotulado "IA x especialista"). Uma por chamado.
create table public.validacoes (
  id                    uuid primary key default gen_random_uuid(),
  chamado_id            uuid not null unique references public.chamados (id) on delete cascade,
  especialista_id       uuid not null default auth.uid() references auth.users (id),
  praga_nome_comum      text,
  praga_nome_cientifico text not null,
  ia_acertou            boolean not null,
  como_identificar      text,
  manejo                text,
  imagem_alerta         text not null default 'nenhuma'
                        check (imagem_alerta in ('foto_produtor', 'referencia', 'nenhuma')),
  imagem_path           text,
  criado_em             timestamptz not null default now()
);

-- Alerta regional enviado no Telegram (só existe após validação do especialista)
create table public.alertas (
  id            uuid primary key default gen_random_uuid(),
  validacao_id  uuid not null references public.validacoes (id) on delete cascade,
  municipio_cod integer references public.municipios (cod_ibge),
  raio_km       numeric not null default 15 check (raio_km > 0),
  titulo        text not null,
  -- Regra 4: todo alerta termina com o aviso da CATI (garantido também no banco)
  texto         text not null
                check (texto like '%Procure a assistência técnica (CATI) antes de aplicar qualquer produto.'),
  imagem_url    text,
  simulado      boolean not null default false,
  enviado_em    timestamptz not null default now()
);

-- Quem recebe alertas no Telegram (acesso só pela service_role)
create table public.inscritos_telegram (
  chat_id       bigint primary key,
  municipio_cod integer references public.municipios (cod_ibge),
  criado_em     timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. FUNÇÕES E TRIGGERS
-- ---------------------------------------------------------------------

-- Retorna true se o usuário logado é especialista.
-- SECURITY DEFINER evita recursão de RLS ao consultar perfis.
create or replace function public.is_especialista()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'especialista'
  );
$$;

-- Cria o perfil 'produtor' para todo novo usuário do Auth (inclusive anônimo)
create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, papel, nome)
  values (new.id, 'produtor', new.raw_user_meta_data ->> 'nome')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();


-- ---------------------------------------------------------------------
-- 3. RLS (ativado em TODAS as tabelas)
-- service_role ignora RLS; tabela sem policy de escrita = escrita só pela service_role.
-- ---------------------------------------------------------------------

alter table public.perfis               enable row level security;
alter table public.municipios           enable row level security;
alter table public.agrofit_pragas       enable row level security;
alter table public.agrofit_produtos     enable row level security;
alter table public.chamados             enable row level security;
alter table public.chamados_localizacao enable row level security;
alter table public.sugestoes_ia         enable row level security;
alter table public.validacoes           enable row level security;
alter table public.alertas              enable row level security;
alter table public.inscritos_telegram   enable row level security;

-- perfis: cada um lê só o próprio. Sem UPDATE, para ninguém se promover a especialista.
create policy "perfis: ler o proprio" on public.perfis
  for select to authenticated
  using (id = (select auth.uid()));

-- municipios e agrofit_*: leitura pública
create policy "municipios: leitura publica" on public.municipios
  for select to anon, authenticated using (true);

create policy "agrofit_pragas: leitura publica" on public.agrofit_pragas
  for select to anon, authenticated using (true);

create policy "agrofit_produtos: leitura publica" on public.agrofit_produtos
  for select to anon, authenticated using (true);

-- chamados
create policy "chamados: produtor insere os proprios" on public.chamados
  for insert to authenticated
  with check (produtor_id = (select auth.uid()));

create policy "chamados: produtor le os proprios" on public.chamados
  for select to authenticated
  using (produtor_id = (select auth.uid()));

create policy "chamados: especialista le todos" on public.chamados
  for select to authenticated
  using ((select public.is_especialista()));

create policy "chamados: especialista atualiza" on public.chamados
  for update to authenticated
  using ((select public.is_especialista()))
  with check ((select public.is_especialista()));

-- RLS não limita colunas: o especialista só pode alterar a coluna status
revoke update on public.chamados from anon, authenticated;
grant update (status) on public.chamados to authenticated;

-- chamados_localizacao: só o dono do chamado (especialista não tem acesso)
create policy "localizacao: produtor insere a propria" on public.chamados_localizacao
  for insert to authenticated
  with check (exists (
    select 1 from public.chamados c
    where c.id = chamado_id and c.produtor_id = (select auth.uid())
  ));

create policy "localizacao: produtor le a propria" on public.chamados_localizacao
  for select to authenticated
  using (exists (
    select 1 from public.chamados c
    where c.id = chamado_id and c.produtor_id = (select auth.uid())
  ));

-- sugestoes_ia: especialista lê; escrita só pela Edge Function (service_role)
create policy "sugestoes_ia: especialista le" on public.sugestoes_ia
  for select to authenticated
  using ((select public.is_especialista()));

-- validacoes
create policy "validacoes: especialista insere" on public.validacoes
  for insert to authenticated
  with check ((select public.is_especialista()) and especialista_id = (select auth.uid()));

create policy "validacoes: especialista le" on public.validacoes
  for select to authenticated
  using ((select public.is_especialista()));

create policy "validacoes: produtor le as dos proprios chamados" on public.validacoes
  for select to authenticated
  using (exists (
    select 1 from public.chamados c
    where c.id = chamado_id and c.produtor_id = (select auth.uid())
  ));

-- alertas: leitura pública
create policy "alertas: leitura publica" on public.alertas
  for select to anon, authenticated using (true);

-- inscritos_telegram: nenhuma policy (só service_role). Reforço com revoke.
revoke all on public.inscritos_telegram from anon, authenticated;


-- ---------------------------------------------------------------------
-- 4. VIEW DA FILA DO ESPECIALISTA
-- security_invoker = true: aplica o RLS de quem consulta. Sem coordenada e sem produtor_id.
-- ---------------------------------------------------------------------

create view public.vw_fila_especialista
with (security_invoker = true) as
select
  c.id,
  c.cultura,
  c.descricao,
  c.foto_path,
  c.municipio_cod,
  m.nome        as municipio_nome,
  m.uf          as municipio_uf,
  c.status,
  c.simulado,
  c.criado_em,
  s.candidatas  as ia_candidatas,
  s.modelo      as ia_modelo,
  s.erro        as ia_erro,
  s.criado_em   as ia_criado_em
from public.chamados c
left join public.municipios m on m.cod_ibge = c.municipio_cod
left join lateral (
  select si.candidatas, si.modelo, si.erro, si.criado_em
  from public.sugestoes_ia si
  where si.chamado_id = c.id
  order by si.criado_em desc
  limit 1
) s on true;

revoke all on public.vw_fila_especialista from anon;


-- ---------------------------------------------------------------------
-- 5. STORAGE
-- ---------------------------------------------------------------------

-- fotos: privado, só imagens recomprimidas (jpeg/webp), até 5 MB
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 5242880, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- alertas: público (imagens aprovadas pelo especialista)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('alertas', 'alertas', true, 5242880, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do nothing;

-- fotos: produtor envia só na pasta {auth.uid()}/
create policy "fotos: produtor envia na propria pasta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- fotos: produtor lê as próprias; especialista lê todas
create policy "fotos: dono ou especialista le" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fotos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_especialista())
    )
  );

-- alertas: escrita só por especialista (leitura é pública pela URL do bucket)
create policy "alertas: especialista envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'alertas' and (select public.is_especialista()));

create policy "alertas: especialista atualiza" on storage.objects
  for update to authenticated
  using (bucket_id = 'alertas' and (select public.is_especialista()))
  with check (bucket_id = 'alertas' and (select public.is_especialista()));

create policy "alertas: especialista remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'alertas' and (select public.is_especialista()));


-- ---------------------------------------------------------------------
-- 6. REALTIME (fila ao vivo; o Realtime respeita o RLS de quem assina)
-- ---------------------------------------------------------------------

alter publication supabase_realtime add table public.chamados, public.sugestoes_ia;
