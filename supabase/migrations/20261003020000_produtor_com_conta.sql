-- =====================================================================
-- Produtor passa a entrar com conta (celular + senha).
-- Sessões anônimas (versão sem login) não podem mais criar chamado nem enviar foto,
-- mesmo chamando a API direto. Chamados antigos continuam legíveis pelo dono.
-- =====================================================================

-- true quando o usuário logado tem conta de verdade (não é sessão anônima)
create or replace function public.conta_permanente()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false;
$$;

drop policy "chamados: produtor insere os proprios" on public.chamados;
create policy "chamados: produtor insere os proprios" on public.chamados
  for insert to authenticated
  with check (produtor_id = (select auth.uid()) and (select public.conta_permanente()));

drop policy "fotos: produtor envia na propria pasta" on storage.objects;
create policy "fotos: produtor envia na propria pasta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.conta_permanente())
  );
