-- =====================================================================
-- Ajustes nas tabelas agrofit_* após inspecionar o CSV real
-- (agrofitprodutosformulados.csv, colunas NR_REGISTRO, CLASSE etc.)
-- As tabelas ainda estão vazias, então dá para usar NOT NULL sem default.
-- =====================================================================

-- agrofit_pragas: colunas de busca (minúsculas, sem acento) e uma linha por praga/cultura
alter table public.agrofit_pragas
  add column cultura_busca text not null,
  add column praga_busca   text not null;

alter table public.agrofit_pragas
  add constraint agrofit_pragas_cultura_praga_key unique (cultura, praga_nome_cientifico);

drop index if exists public.agrofit_pragas_cultura_idx;
create index agrofit_pragas_cultura_busca_idx on public.agrofit_pragas (cultura_busca);

-- agrofit_produtos: número de registro (chave real do produto) e classe (Inseticida, Fungicida...)
alter table public.agrofit_produtos
  add column nr_registro   text not null,
  add column classe        text,
  add column cultura_busca text not null;

alter table public.agrofit_produtos
  add constraint agrofit_produtos_registro_cultura_praga_key
  unique (nr_registro, cultura, praga_nome_cientifico);

drop index if exists public.agrofit_produtos_cultura_praga_idx;
create index agrofit_produtos_cultura_busca_praga_idx
  on public.agrofit_produtos (cultura_busca, praga_nome_cientifico);
