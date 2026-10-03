-- =====================================================================
-- Cargo de administrador: dashboard executivo e cadastro de especialistas.
-- Uma conta continua com um papel só. O primeiro administrador é promovido
-- pelo SQL Editor; especialistas são criados pela Edge Function admin-especialistas.
-- O administrador lê só NÚMEROS AGREGADOS: nada de chamado individual nem localização.
-- =====================================================================

alter table public.perfis drop constraint perfis_papel_check;
alter table public.perfis
  add constraint perfis_papel_check check (papel in ('produtor', 'especialista', 'administrador'));

create or replace function public.is_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'administrador'
  );
$$;

-- Chamado e foto de produtor: recusa também conta de administrador
drop policy "chamados: produtor insere os proprios" on public.chamados;
create policy "chamados: produtor insere os proprios" on public.chamados
  for insert to authenticated
  with check (
    produtor_id = (select auth.uid())
    and (select public.conta_permanente())
    and not (select public.is_especialista())
    and not (select public.is_administrador())
  );

drop policy "fotos: produtor envia na propria pasta" on storage.objects;
create policy "fotos: produtor envia na propria pasta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.conta_permanente())
    and not (select public.is_especialista())
    and not (select public.is_administrador())
  );

-- ---------------------------------------------------------------------
-- Dashboard executivo: só agregados. incluir_simulados = false ignora a demo.
-- ---------------------------------------------------------------------
create or replace function public.painel_admin(incluir_simulados boolean default true)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  resultado jsonb;
begin
  if not public.is_administrador() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;

  with
  ch as (select * from public.chamados where incluir_simulados or not simulado),
  -- só alertas enviados de verdade, ou os simulados da demonstração
  al as (
    select a.*, coalesce(nullif(trim(split_part(a.praga_nome_comum, ';', 1)), ''), a.praga_nome_cientifico, 'Praga') as praga
    from public.alertas a
    where (a.simulado or a.canal_enviado or a.destinatarios > 0) and (incluir_simulados or not a.simulado)
  ),
  va as (select v.*, c.criado_em as chamado_em from public.validacoes v join ch c on c.id = v.chamado_id)
  select jsonb_build_object(
    'usuarios', (
      select jsonb_build_object(
        'produtores', count(*) filter (where p.papel = 'produtor' and not coalesce(u.is_anonymous, false)),
        'especialistas', count(*) filter (where p.papel = 'especialista'),
        'especialistas_bloqueados', count(*) filter (where p.papel = 'especialista' and u.banned_until > now()),
        'administradores', count(*) filter (where p.papel = 'administrador'),
        'novos_produtores_mes', count(*) filter (
          where p.papel = 'produtor' and not coalesce(u.is_anonymous, false) and p.criado_em >= now() - interval '30 days')
      )
      from public.perfis p join auth.users u on u.id = p.id
    ),
    'chamados', (
      select jsonb_build_object(
        'total', count(*),
        'em_analise', count(*) filter (where status = 'em_analise'),
        'analisados', count(*) filter (where status = 'analisado'),
        'descartados', count(*) filter (where status = 'descartado'),
        'simulados', count(*) filter (where simulado),
        'hoje', count(*) filter (where (criado_em at time zone 'America/Sao_Paulo')::date = hoje),
        'semana', count(*) filter (where criado_em >= now() - interval '7 days'),
        'mes', count(*) filter (where criado_em >= now() - interval '30 days')
      )
      from ch
    ),
    'alertas', (
      select jsonb_build_object(
        'total', count(*),
        'simulados', count(*) filter (where simulado),
        'hoje', count(*) filter (where (enviado_em at time zone 'America/Sao_Paulo')::date = hoje),
        'semana', count(*) filter (where enviado_em >= now() - interval '7 days'),
        'mes', count(*) filter (where enviado_em >= now() - interval '30 days'),
        'municipios', count(distinct municipio_cod),
        'pragas', count(distinct praga)
      )
      from al
    ),
    'acerto_ia', (select round(avg(case when ia_acertou then 1 else 0 end)::numeric, 2) from va where ia_acertou is not null),
    'respostas_com_ia', (select count(*) from va where ia_acertou is not null),
    'horas_ate_resposta', (select round((extract(epoch from avg(criado_em - chamado_em)) / 3600)::numeric, 1) from va),
    -- Série diária dos últimos 30 dias (dias sem nada entram com zero)
    'por_dia', (
      select jsonb_agg(jsonb_build_object(
        'dia', d::date,
        'chamados', (select count(*) from ch where (ch.criado_em at time zone 'America/Sao_Paulo')::date = d::date),
        'alertas', (select count(*) from al where (al.enviado_em at time zone 'America/Sao_Paulo')::date = d::date)
      ) order by d)
      from generate_series(hoje - 29, hoje, interval '1 day') d
    ),
    'pragas', (
      select coalesce(jsonb_agg(x order by x.alertas desc, x.praga), '[]'::jsonb)
      from (
        select praga, max(praga_nome_cientifico) as cientifico, count(*) as alertas,
               count(distinct municipio_cod) as municipios, max(enviado_em) as ultimo
        from al group by praga
      ) x
    ),
    'municipios', (
      select coalesce(jsonb_agg(x order by x.alertas desc, x.municipio, x.praga), '[]'::jsonb)
      from (
        select m.nome as municipio, a.praga, count(*) as alertas, max(a.enviado_em) as ultimo
        from al a join public.municipios m on m.cod_ibge = a.municipio_cod
        group by m.nome, a.praga
      ) x
    ),
    'culturas', (
      select coalesce(jsonb_agg(x order by x.chamados desc), '[]'::jsonb)
      from (select cultura, count(*) as chamados from ch group by cultura) x
    )
  ) into resultado;

  return resultado;
end;
$$;

-- Especialistas cadastrados (nome, e-mail, situação, quantas análises fez)
create or replace function public.listar_especialistas()
returns table (id uuid, nome text, email text, criado_em timestamptz, bloqueado boolean, analises bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_administrador() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;
  return query
    select p.id, p.nome, u.email::text, p.criado_em, coalesce(u.banned_until > now(), false),
           (select count(*) from public.validacoes v where v.especialista_id = p.id)
    from public.perfis p
    join auth.users u on u.id = p.id
    where p.papel = 'especialista'
    order by p.nome nulls last, u.email;
end;
$$;

revoke all on function public.painel_admin(boolean) from public, anon;
revoke all on function public.listar_especialistas() from public, anon;
grant execute on function public.painel_admin(boolean) to authenticated;
grant execute on function public.listar_especialistas() to authenticated;
