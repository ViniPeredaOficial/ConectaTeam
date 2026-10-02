-- =====================================================================
-- Aviso ao produtor pelo Telegram quando o chamado dele for respondido.
-- O produtor liga a conta ao bot por um link com código de uso único
-- (t.me/<bot>?start=<código>), válido por 30 minutos.
-- =====================================================================

-- Conversa do Telegram ligada à conta. RLS de perfis: só o próprio usuário lê;
-- ninguém escreve pelo app (o GRANT de UPDATE é só da coluna nome). Quem grava é o bot.
alter table public.perfis add column telegram_chat_id bigint;
create unique index perfis_telegram_chat_unico on public.perfis (telegram_chat_id) where telegram_chat_id is not null;

-- Marca quando o produtor foi avisado (evita aviso repetido)
alter table public.chamados add column produtor_avisado_em timestamptz;

-- Códigos de uso único para ligar a conta (acesso só pelo servidor)
create table public.codigos_telegram (
  codigo     text primary key,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  expira_em  timestamptz not null default now() + interval '30 minutes'
);
alter table public.codigos_telegram enable row level security;
revoke all on public.codigos_telegram from anon, authenticated;

-- Gera o código para o usuário logado (só conta de verdade, não anônima)
create or replace function public.gerar_codigo_telegram()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo text := replace(gen_random_uuid()::text, '-', ''); -- 32 caracteres aleatórios
begin
  if (select auth.uid()) is null or not (select public.conta_permanente()) then
    raise exception 'Entre com sua conta para ligar o Telegram';
  end if;
  -- Um código válido por usuário; aproveita para limpar os vencidos
  delete from public.codigos_telegram where usuario_id = (select auth.uid()) or expira_em < now();
  insert into public.codigos_telegram (codigo, usuario_id) values (novo, (select auth.uid()));
  return novo;
end;
$$;

-- Desliga os avisos da própria conta
create or replace function public.desligar_avisos_telegram()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfis set telegram_chat_id = null where id = (select auth.uid());
$$;

revoke all on function public.gerar_codigo_telegram() from public, anon;
revoke all on function public.desligar_avisos_telegram() from public, anon;
grant execute on function public.gerar_codigo_telegram() to authenticated;
grant execute on function public.desligar_avisos_telegram() to authenticated;
