-- =====================================================================
-- Permite ao usuário editar só o próprio nome (campo opcional da tela do produtor).
-- O papel continua travado: o GRANT é só da coluna "nome", então ninguém
-- consegue se promover a especialista.
-- =====================================================================

create policy "perfis: editar o proprio nome" on public.perfis
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.perfis from anon, authenticated;
grant update (nome) on public.perfis to authenticated;

-- Nome com tamanho razoável
alter table public.perfis
  add constraint perfis_nome_tamanho check (nome is null or char_length(nome) <= 80);
