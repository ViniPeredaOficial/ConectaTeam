-- =====================================================================
-- sugestoes_ia.observacao: explicação da IA quando não identifica a praga
-- (ex.: "foto desfocada"), separada de "erro" (falha técnica: timeout, API fora).
-- =====================================================================

alter table public.sugestoes_ia add column observacao text;

-- Recria a view com a nova coluna no final (create or replace só permite acrescentar)
create or replace view public.vw_fila_especialista
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
  s.criado_em   as ia_criado_em,
  s.observacao  as ia_observacao
from public.chamados c
left join public.municipios m on m.cod_ibge = c.municipio_cod
left join lateral (
  select si.candidatas, si.modelo, si.erro, si.criado_em, si.observacao
  from public.sugestoes_ia si
  where si.chamado_id = c.id
  order by si.criado_em desc
  limit 1
) s on true;
