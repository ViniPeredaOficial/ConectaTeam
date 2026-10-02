-- =====================================================================
-- alertas: cultura e praga para o mapa público.
-- O mapa lê só alertas + municipios (leitura pública); validacoes continua restrita.
-- =====================================================================

alter table public.alertas
  add column cultura               text,
  add column praga_nome_comum      text,
  add column praga_nome_cientifico text;

-- Preenche os alertas que já existem
update public.alertas a
set cultura = c.cultura,
    praga_nome_comum = v.praga_nome_comum,
    praga_nome_cientifico = v.praga_nome_cientifico
from public.validacoes v
join public.chamados c on c.id = v.chamado_id
where v.id = a.validacao_id;

-- Consulta do mapa: alertas recentes
create index alertas_enviado_em_idx on public.alertas (enviado_em desc);
