-- =====================================================================
-- Uma conta é produtor OU especialista.
-- Conta de especialista não cria chamado nem envia foto de produtor,
-- mesmo chamando a API direto (o front também bloqueia a área do produtor).
-- =====================================================================

drop policy "chamados: produtor insere os proprios" on public.chamados;
create policy "chamados: produtor insere os proprios" on public.chamados
  for insert to authenticated
  with check (
    produtor_id = (select auth.uid())
    and (select public.conta_permanente())
    and not (select public.is_especialista())
  );

drop policy "fotos: produtor envia na propria pasta" on storage.objects;
create policy "fotos: produtor envia na propria pasta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.conta_permanente())
    and not (select public.is_especialista())
  );
