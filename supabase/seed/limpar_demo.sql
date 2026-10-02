-- =====================================================================
-- Apaga TODOS os dados simulados (simulado = true).
-- Os chamados levam junto, em cascata: sugestões da IA, localizações,
-- validações e os alertas ligados a elas.
-- =====================================================================

delete from public.alertas where simulado;
delete from public.chamados where simulado;

-- Conferência: deve mostrar 0 e 0
select
  (select count(*) from public.chamados where simulado) as chamados_simulados,
  (select count(*) from public.alertas where simulado) as alertas_simulados;
