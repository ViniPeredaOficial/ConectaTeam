-- =====================================================================
-- Dados de DEMONSTRAÇÃO da região de Araraquara (todos com simulado = true).
-- 15 chamados nas últimas 3 semanas: 8 analisados com alerta, 5 em análise, 2 descartados.
-- Pode rodar quantas vezes quiser: apaga a demo anterior e recria.
-- Para apagar sem recriar: supabase/seed/limpar_demo.sql
--
-- Pré-requisitos:
--   1. Migrations aplicadas e CSVs do Agrofit/municípios importados.
--   2. Pelo menos um usuário com perfis.papel = 'especialista' (autor das validações).
--   3. (Opcional) usuário produtor.demo@radardepragas.app como autor dos chamados;
--      sem ele, o especialista é usado também como produtor.
--
-- Pragas e produtos vêm das tabelas do Agrofit (nada inventado). Confiança, justificativas
-- e textos do especialista são simulados. Sem imagens (nunca fotos de pessoas).
-- Os alertas simulados NÃO são enviados ao Telegram (canal_enviado = false).
-- =====================================================================

-- Candidata no mesmo formato da Edge Function triagem, com até 10 produtos reais
create or replace function pg_temp.candidata(
  p_cultura text, p_cientifico text, p_confianca numeric, p_justificativa text
) returns jsonb language plpgsql as $$
declare
  resultado jsonb;
begin
  select jsonb_build_object(
    'praga_nome_comum', pr.praga_nome_comum,
    'praga_nome_cientifico', pr.praga_nome_cientifico,
    'confianca', p_confianca,
    'justificativa', p_justificativa,
    'produtos', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.biologico desc, x.organico desc, x.marca_comercial)
      from (
        select marca_comercial, ingrediente_ativo, classe, classe_toxicologica, organico, biologico
        from public.agrofit_produtos
        where cultura = p_cultura and praga_nome_cientifico = p_cientifico
        order by biologico desc, organico desc, marca_comercial
        limit 10
      ) x
    ), '[]'::jsonb)
  ) into resultado
  from public.agrofit_pragas pr
  where pr.cultura = p_cultura and pr.praga_nome_cientifico = p_cientifico;

  if resultado is null then
    raise exception 'Praga % não encontrada no Agrofit para %', p_cientifico, p_cultura;
  end if;
  return resultado;
end;
$$;

-- Chamado simulado + sugestão da IA + localização aproximada (centro do município com desvio)
create or replace function pg_temp.chamado(
  p_produtor uuid, p_cultura text, p_descricao text, p_municipio integer, p_dias_atras numeric,
  p_status text, p_candidatas jsonb, p_erro text default null, p_observacao text default null
) returns uuid language plpgsql as $$
declare
  novo_id uuid;
  quando timestamptz := now() - make_interval(secs => p_dias_atras * 86400);
begin
  insert into public.chamados (produtor_id, cultura, descricao, foto_path, municipio_cod, status, simulado, criado_em)
  values (p_produtor, p_cultura, p_descricao, null, p_municipio, p_status, true, quando)
  returning id into novo_id;

  insert into public.chamados_localizacao (chamado_id, lat, lon)
  select novo_id, m.lat + (random() - 0.5) * 0.04, m.lon + (random() - 0.5) * 0.04
  from public.municipios m where m.cod_ibge = p_municipio;

  insert into public.sugestoes_ia (chamado_id, modelo, candidatas, erro, observacao, criado_em)
  values (novo_id, 'gemini-3.5-flash (simulado)', p_candidatas, p_erro, p_observacao, quando + interval '2 minutes');

  return novo_id;
end;
$$;

-- Validação do especialista + alerta (mesmo texto da Edge Function alerta, terminando no aviso da CATI)
create or replace function pg_temp.validar(
  p_chamado uuid, p_especialista uuid, p_cientifico text, p_como text, p_manejo text
) returns void language plpgsql as $$
declare
  c record;
  p record;
  v_id uuid;
  primeira text;
  produtos text;
  nome text;
  texto text;
  quando timestamptz;
begin
  select ch.*, m.nome as municipio_nome into c
  from public.chamados ch join public.municipios m on m.cod_ibge = ch.municipio_cod
  where ch.id = p_chamado;
  select * into p from public.agrofit_pragas where cultura = c.cultura and praga_nome_cientifico = p_cientifico;
  if not found then raise exception 'Praga % não encontrada para %', p_cientifico, c.cultura; end if;

  -- A IA acertou se a praga final é a 1ª sugestão
  select s.candidatas -> 0 ->> 'praga_nome_cientifico' into primeira
  from public.sugestoes_ia s where s.chamado_id = p_chamado;

  quando := c.criado_em + interval '3 hours';
  insert into public.validacoes (chamado_id, especialista_id, praga_nome_comum, praga_nome_cientifico,
                                 ia_acertou, como_identificar, manejo, imagem_alerta, imagem_path, criado_em)
  values (p_chamado, p_especialista, p.praga_nome_comum, p.praga_nome_cientifico,
          case when primeira is null then null else primeira = p_cientifico end,
          p_como, p_manejo, 'nenhuma', null, quando)
  returning id into v_id;

  -- Até 5 nomes comerciais, biológicos primeiro (sem concentração)
  select string_agg(n.nome_produto, ', ' order by n.ordem) into produtos
  from (
    select nome_produto, min(ordem) as ordem
    from (
      select trim(split_part(marca_comercial, ';', 1)) as nome_produto,
             row_number() over (order by biologico desc, organico desc, marca_comercial) as ordem
      from public.agrofit_produtos
      where cultura = c.cultura and praga_nome_cientifico = p_cientifico
    ) t
    group by nome_produto
    order by ordem
    limit 5
  ) n;

  -- Só o primeiro nome comum (o Agrofit junta vários com ";"), como na Edge Function
  nome := coalesce(nullif(trim(split_part(p.praga_nome_comum, ';', 1)), '') || ' (' || p.praga_nome_cientifico || ')', p.praga_nome_cientifico);
  texto := '🧪 SIMULADO (dado de demonstração)'
    || E'\n\n🚨 Alerta de praga: ' || nome
    || E'\n\n📍 Região: ' || c.municipio_nome || ' e arredores (raio de 15 km)'
    || E'\n\n🌱 Cultura: ' || c.cultura
    || E'\n\n🔎 Como identificar: ' || p_como
    || E'\n\n🛠️ Manejo: ' || p_manejo
    || coalesce(E'\n\n✅ Produtos registrados no Agrofit para esta cultura: ' || produtos, '')
    || E'\n\nFonte: Agrofit/MAPA. Validado por especialista.'
    || E'\n\n⚠️ Procure a assistência técnica (CATI) antes de aplicar qualquer produto.';

  insert into public.alertas (validacao_id, municipio_cod, raio_km, titulo, texto, imagem_url, simulado,
                              enviado_em, destinatarios, canal_enviado,
                              cultura, praga_nome_comum, praga_nome_cientifico)
  values (v_id, c.municipio_cod, 15, 'Alerta de praga: ' || nome, texto, null, true,
          quando + interval '1 minute', 0, false,
          c.cultura, p.praga_nome_comum, p.praga_nome_cientifico);

  update public.chamados set status = 'analisado' where id = p_chamado;
end;
$$;

do $$
declare
  especialista uuid;
  produtor uuid;
  c uuid;
  -- Municípios (código IBGE)
  araraquara constant integer := 3503208;
  americo    constant integer := 3501707;
  sao_carlos constant integer := 3548906;
  ibate      constant integer := 3519303;
  matao      constant integer := 3529302;
  rincao     constant integer := 3543709;
  santa_lucia constant integer := 3546900;
  boa_esperanca constant integer := 3506706;
begin
  select id into especialista from public.perfis where papel = 'especialista' order by criado_em limit 1;
  if especialista is null then
    raise exception 'Crie antes um usuário especialista (veja o README).';
  end if;
  select id into produtor from auth.users where email = 'produtor.demo@radardepragas.app';
  produtor := coalesce(produtor, especialista);

  -- Limpa a demo anterior (sugestões, localizações, validações e alertas caem em cascata)
  delete from public.chamados where simulado;

  -- ---------------- ANALISADOS, com alerta (8) ----------------

  -- 1. Tomate, Araraquara, há 20 dias: traça (IA acertou)
  c := pg_temp.chamado(produtor, 'Tomate', 'Folhas com galerias transparentes e frutos furados, com lagartinhas dentro.',
    araraquara, 20, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Tomate', 'Tuta absoluta', 0.84, 'Minas translúcidas nas folhas e furos nos frutos, típicos da traça-do-tomateiro.'),
      pg_temp.candidata('Tomate', 'Neoleucinodes elegantalis', 0.30, 'Furos nos frutos também ocorrem com a broca-pequena, mas ela não faz minas nas folhas.')));
  perform pg_temp.validar(c, especialista, 'Tuta absoluta',
    'Minas (galerias claras) nas folhas, frutos com furos pequenos e lagartas esverdeadas de até 1 cm.',
    'Retirar e destruir folhas e frutos atacados, monitorar com armadilha de feromônio e dar preferência a produtos biológicos registrados.');

  -- 2. Tomate, Américo Brasiliense, há 17 dias: traça (IA acertou)
  c := pg_temp.chamado(produtor, 'Tomate', 'Folhas secando com manchas claras, vi umas lagartas pequenas.',
    americo, 17, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Tomate', 'Tuta absoluta', 0.79, 'Manchas claras que secam e lagartas pequenas indicam minas da traça.')));
  perform pg_temp.validar(c, especialista, 'Tuta absoluta',
    'Manchas claras e secas nas folhas (minas) com lagartas pequenas dentro; ataque também nos frutos.',
    'Eliminar restos de cultura, monitorar duas vezes por semana e usar apenas produtos registrados para tomate.');

  -- 3. Café, São Carlos, há 14 dias: ferrugem (IA acertou)
  c := pg_temp.chamado(produtor, 'Café', 'Pó alaranjado embaixo das folhas e muitas folhas caindo.',
    sao_carlos, 14, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Café', 'Hemileia vastatrix', 0.90, 'Pústulas de pó alaranjado na face inferior e desfolha: sinais clássicos da ferrugem.')));
  perform pg_temp.validar(c, especialista, 'Hemileia vastatrix',
    'Pó alaranjado na parte de baixo das folhas, manchas amareladas em cima e queda de folhas.',
    'Monitorar o talhão, manter a lavoura bem nutrida e procurar a CATI para escolher um produto registrado para café.');

  -- 4. Alface, Ibaté, há 12 dias: míldio (IA acertou)
  c := pg_temp.chamado(produtor, 'Alface', 'Manchas amareladas em cima das folhas e um mofo branco embaixo.',
    ibate, 12, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Alface', 'Bremia lactucae', 0.81, 'Manchas angulares amarelas com esporulação branca na face inferior: míldio.'),
      pg_temp.candidata('Alface', 'Sclerotinia sclerotiorum', 0.20, 'Mofo branco também ocorre, mas costuma atingir a base da planta.')));
  perform pg_temp.validar(c, especialista, 'Bremia lactucae',
    'Manchas amarelas delimitadas pelas nervuras e mofo esbranquiçado na parte de baixo das folhas.',
    'Evitar molhar as folhas no fim do dia, aumentar o espaçamento para ventilar e retirar folhas atacadas.');

  -- 5. Café, Matão, há 9 dias: bicho-mineiro (IA ERROU: sugeriu broca primeiro)
  c := pg_temp.chamado(produtor, 'Café', 'Folhas com manchas marrons secas, parece queimado.',
    matao, 9, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Café', 'Hypothenemus hampei', 0.48, 'Danos escuros podem indicar broca, mas a foto mostra pouco dos frutos.'),
      pg_temp.candidata('Café', 'Leucoptera coffeella', 0.41, 'Manchas marrons secas nas folhas podem ser minas do bicho-mineiro.')));
  perform pg_temp.validar(c, especialista, 'Leucoptera coffeella',
    'Manchas marrons nas folhas cuja película se solta (minas); a broca ataca frutos, não folhas.',
    'Monitorar folhas do terço médio das plantas e preservar inimigos naturais (vespas predadoras).');

  -- 6. Tomate, Araraquara, há 6 dias: mosca-branca (IA acertou)
  c := pg_temp.chamado(produtor, 'Tomate', 'Muita mosquinha branca embaixo das folhas, folhas amareladas.',
    araraquara, 6, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Tomate', 'Bemisia tabaci', 0.75, 'Insetos brancos e pequenos na face inferior das folhas, com amarelecimento.')));
  perform pg_temp.validar(c, especialista, 'Bemisia tabaci',
    'Insetos brancos pequenos que voam ao mexer na planta, na parte de baixo das folhas.',
    'Usar armadilhas adesivas amarelas, eliminar plantas daninhas hospedeiras e restos de cultura.');

  -- 7. Alface, Rincão, há 3 dias: pulgão (IA ERROU: sugeriu mosca-branca primeiro)
  c := pg_temp.chamado(produtor, 'Alface', 'Bichinhos verdes no miolo da alface, folhas enrugadas.',
    rincao, 3, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Alface', 'Bemisia tabaci', 0.52, 'Insetos pequenos nas folhas podem ser mosca-branca.'),
      pg_temp.candidata('Alface', 'Myzus persicae', 0.44, 'Colônias verdes no miolo e folhas enrugadas sugerem pulgão.')));
  perform pg_temp.validar(c, especialista, 'Myzus persicae',
    'Colônias de insetos verdes e moles no miolo e nas folhas novas, que ficam enrugadas.',
    'Retirar plantas muito atacadas, preservar joaninhas e outros inimigos naturais e monitorar as bordas do canteiro.');

  -- 8. Tomate, Santa Lúcia, hoje: broca-pequena (IA acertou)
  c := pg_temp.chamado(produtor, 'Tomate', 'Frutos verdes com furinhos e por dentro tem lagarta.',
    santa_lucia, 0.3, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Tomate', 'Neoleucinodes elegantalis', 0.70, 'Furos pequenos em frutos verdes com lagarta interna: broca-pequena.'),
      pg_temp.candidata('Tomate', 'Tuta absoluta', 0.40, 'A traça também fura frutos, mas costuma deixar minas nas folhas.')));
  perform pg_temp.validar(c, especialista, 'Neoleucinodes elegantalis',
    'Furos bem pequenos em frutos ainda verdes e lagarta rosada dentro do fruto.',
    'Recolher e destruir frutos furados e monitorar a lavoura desde o início da frutificação.');

  -- ---------------- EM ANÁLISE (5) ----------------

  perform pg_temp.chamado(produtor, 'Café', 'Folhas com pó amarelo-alaranjado, começou nas plantas de baixo.',
    boa_esperanca, 1.5, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Café', 'Hemileia vastatrix', 0.66, 'Pó alaranjado nas folhas é compatível com ferrugem.')));

  perform pg_temp.chamado(produtor, 'Tomate', 'Folhas com caminhos brancos por dentro.',
    araraquara, 0.6, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Tomate', 'Tuta absoluta', 0.80, 'Galerias brancas dentro das folhas são minas típicas da traça.')));

  -- IA fora do ar: o especialista segue sem a sugestão
  perform pg_temp.chamado(produtor, 'Alface', 'Folhas murchando e apodrecendo perto do chão.',
    sao_carlos, 0.4, 'em_analise', '[]'::jsonb, 'timeout');

  -- Foto ruim: a IA explica em "observacao"
  perform pg_temp.chamado(produtor, 'Café', 'Planta fraca.',
    araraquara, 0.2, 'em_analise', '[]'::jsonb, null,
    'A foto está escura e de longe; não é possível ver sintomas. Peça uma nova foto, de perto e com luz natural.');

  perform pg_temp.chamado(produtor, 'Tomate', 'Folhas grudentas e com mosquinhas.',
    matao, 0.05, 'em_analise', jsonb_build_array(
      pg_temp.candidata('Tomate', 'Bemisia tabaci', 0.62, 'Folhas grudentas e insetos pequenos sugerem mosca-branca.'),
      pg_temp.candidata('Tomate', 'Myzus persicae', 0.35, 'Pulgões também deixam as folhas grudentas.')));

  -- ---------------- DESCARTADOS (2) ----------------

  perform pg_temp.chamado(produtor, 'Alface', 'Só queria ver se o app funciona.',
    ibate, 8, 'descartado', '[]'::jsonb, null, 'A foto mostra folhas sadias, sem sintomas de praga.');

  perform pg_temp.chamado(produtor, 'Café', 'Teste.',
    rincao, 5, 'descartado', '[]'::jsonb, null, 'Não há planta na foto.');

  raise notice 'Demo recriada: 15 chamados simulados e 8 alertas na região de Araraquara.';
end;
$$;

-- Conferência
select c.status, c.cultura, m.nome as municipio, jsonb_array_length(s.candidatas) as candidatas,
       v.ia_acertou, a.id is not null as tem_alerta
from public.chamados c
join public.municipios m on m.cod_ibge = c.municipio_cod
left join public.sugestoes_ia s on s.chamado_id = c.id
left join public.validacoes v on v.chamado_id = c.id
left join public.alertas a on a.validacao_id = v.id
where c.simulado
order by c.criado_em;
