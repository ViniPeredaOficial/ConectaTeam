-- =====================================================================
-- validacoes.ia_acertou passa a aceitar nulo.
--   true  = praga final igual à 1ª sugestão da IA
--   false = a IA sugeriu, mas errou
--   null  = a IA não sugeriu nada (falhou ou não identificou)
-- Assim a taxa de acerto e o dado rotulado não contam falha técnica como erro da IA.
-- =====================================================================

alter table public.validacoes alter column ia_acertou drop not null;

comment on column public.validacoes.ia_acertou is
  'true: praga final = 1ª sugestão da IA; false: IA errou; null: IA não sugeriu';
