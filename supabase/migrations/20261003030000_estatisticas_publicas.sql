-- =====================================================================
-- Números públicos da landing page.
-- O público continua sem acesso a chamados/validacoes: estas funções devolvem
-- só totais agregados (nada pessoal), sempre separando os dados simulados.
-- =====================================================================

-- Totais do sistema (SECURITY DEFINER: conta linhas que o anônimo não pode ler)
create or replace function public.estatisticas_publicas()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with alertas_validos as (
    -- só alertas enviados de verdade, ou os simulados da demonstração
    select * from public.alertas where simulado or canal_enviado or destinatarios > 0
  )
  select jsonb_build_object(
    'chamados',              (select count(*) from public.chamados),
    'chamados_simulados',    (select count(*) from public.chamados where simulado),
    'analisados',            (select count(*) from public.chamados where status = 'analisado'),
    'analisados_simulados',  (select count(*) from public.chamados where status = 'analisado' and simulado),
    'alertas',               (select count(*) from alertas_validos),
    'alertas_simulados',     (select count(*) from alertas_validos where simulado),
    'municipios_com_alerta', (select count(distinct municipio_cod) from alertas_validos),
    'horas_ate_resposta',    (select round((extract(epoch from avg(v.criado_em - c.criado_em)) / 3600)::numeric, 1)
                              from public.validacoes v join public.chamados c on c.id = v.chamado_id),
    'acerto_ia',             (select round(avg(case when ia_acertou then 1 else 0 end)::numeric, 2)
                              from public.validacoes where ia_acertou is not null),
    'respostas_com_ia',      (select count(*) from public.validacoes where ia_acertou is not null)
  );
$$;

revoke all on function public.estatisticas_publicas() from public;
grant execute on function public.estatisticas_publicas() to anon, authenticated;

-- Por cultura: pragas e produtos registrados no Agrofit (tabelas já públicas)
create or replace function public.culturas_monitoradas()
returns table (cultura text, pragas bigint, produtos bigint, produtos_biologicos bigint, principais_pragas text[])
language sql
stable
set search_path = ''
as $$
  select
    p.cultura,
    count(*) as pragas,
    (select count(distinct x.nr_registro) from public.agrofit_produtos x where x.cultura = p.cultura),
    (select count(distinct x.nr_registro) from public.agrofit_produtos x where x.cultura = p.cultura and x.biologico),
    -- as 4 pragas com mais produtos registrados (primeiro nome comum)
    (select array_agg(t.nome order by t.total desc, t.nome)
     from (
       select coalesce(nullif(trim(split_part(pp.praga_nome_comum, ';', 1)), ''), pp.praga_nome_cientifico) as nome,
              count(*) as total
       from public.agrofit_produtos x
       join public.agrofit_pragas pp on pp.cultura = x.cultura and pp.praga_nome_cientifico = x.praga_nome_cientifico
       where x.cultura = p.cultura
       group by 1
       order by 2 desc, 1
       limit 4
     ) t)
  from public.agrofit_pragas p
  group by p.cultura
  order by p.cultura;
$$;

grant execute on function public.culturas_monitoradas() to anon, authenticated;
