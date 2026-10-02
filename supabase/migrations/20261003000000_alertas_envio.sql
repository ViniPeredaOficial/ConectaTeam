-- =====================================================================
-- alertas: resultado do envio e trava contra alerta duplicado
-- =====================================================================

alter table public.alertas
  add column destinatarios integer not null default 0,  -- inscritos que receberam
  add column canal_enviado boolean not null default false;

-- Uma validação gera no máximo um alerta (clique duplo ou retentativa não duplica)
alter table public.alertas
  add constraint alertas_validacao_unica unique (validacao_id);

-- Busca dos inscritos por município
create index inscritos_telegram_municipio_idx on public.inscritos_telegram (municipio_cod);
