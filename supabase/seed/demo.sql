-- =====================================================================
-- Dados de DEMONSTRAÇÃO (simulado = true): rede de segurança caso o Gemini
-- esteja fora do ar na apresentação. Pode rodar quantas vezes quiser: apaga e recria.
--
-- Pré-requisitos:
--   1. Migrations 001 a 003 aplicadas e CSVs do Agrofit/municípios importados.
--   2. Criar em Authentication > Users > Add user o usuário
--      produtor.demo@radardepragas.app (marque "Auto Confirm User").
--   3. (Opcional) Subir fotos em Storage > fotos > pasta "demo" com os nomes usados abaixo.
--
-- As pragas e os produtos vêm das tabelas do Agrofit (nada inventado);
-- só a confiança e a justificativa da "IA" são simuladas.
-- =====================================================================

-- Monta uma candidata no mesmo formato da Edge Function, com até 10 produtos reais
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

-- Cria um chamado simulado + localização aproximada (centro do município com pequeno desvio)
create or replace function pg_temp.chamado(
  p_produtor uuid, p_cultura text, p_descricao text, p_foto text,
  p_municipio integer, p_horas_atras numeric
) returns uuid language plpgsql as $$
declare
  novo_id uuid;
begin
  insert into public.chamados (produtor_id, cultura, descricao, foto_path, municipio_cod, simulado, criado_em)
  values (p_produtor, p_cultura, p_descricao, p_foto, p_municipio, true,
          now() - make_interval(secs => p_horas_atras * 3600))
  returning id into novo_id;

  insert into public.chamados_localizacao (chamado_id, lat, lon)
  select novo_id, m.lat + (random() - 0.5) * 0.04, m.lon + (random() - 0.5) * 0.04
  from public.municipios m where m.cod_ibge = p_municipio;

  return novo_id;
end;
$$;

do $$
declare
  produtor uuid;
  c uuid;
  modelo constant text := 'gemini-3.5-flash (simulado)';
begin
  select id into produtor from auth.users where email = 'produtor.demo@radardepragas.app';
  if produtor is null then
    raise exception 'Crie antes o usuário produtor.demo@radardepragas.app em Authentication > Users';
  end if;

  -- Limpa a demo anterior (sugestões, localizações e validações caem em cascata)
  delete from public.chamados where simulado and produtor_id = produtor;

  -- 1. Tomate, Campinas: traça-do-tomateiro (IA confiante)
  c := pg_temp.chamado(produtor, 'Tomate',
    'Folhas com galerias transparentes e frutos furados. Vi lagartinhas verdes dentro.',
    'demo/tomate-traca.jpg', 3509502, 2);
  insert into public.sugestoes_ia (chamado_id, modelo, candidatas) values (c, modelo, jsonb_build_array(
    pg_temp.candidata('Tomate', 'Tuta absoluta', 0.86, 'Minas translúcidas nas folhas e furos nos frutos, típicos da traça-do-tomateiro.'),
    pg_temp.candidata('Tomate', 'Neoleucinodes elegantalis', 0.32, 'Furos nos frutos também ocorrem com a broca-pequena, mas as minas nas folhas não.')));

  -- 2. Tomate, Sumaré: mosca-branca
  c := pg_temp.chamado(produtor, 'Tomate',
    'Muita mosquinha branca embaixo das folhas e folhas ficando amareladas.',
    'demo/tomate-mosca-branca.jpg', 3552403, 5);
  insert into public.sugestoes_ia (chamado_id, modelo, candidatas) values (c, modelo, jsonb_build_array(
    pg_temp.candidata('Tomate', 'Bemisia tabaci', 0.78, 'Insetos brancos e pequenos na face inferior das folhas, com amarelecimento.'),
    pg_temp.candidata('Tomate', 'Myzus persicae', 0.21, 'Pulgões também causam amarelecimento, mas são verdes e não voam ao mexer na planta.')));

  -- 3. Café, Franca: ferrugem
  c := pg_temp.chamado(produtor, 'Café',
    'Pó alaranjado embaixo das folhas e muitas folhas caindo.',
    'demo/cafe-ferrugem.jpg', 3516200, 24);
  insert into public.sugestoes_ia (chamado_id, modelo, candidatas) values (c, modelo, jsonb_build_array(
    pg_temp.candidata('Café', 'Hemileia vastatrix', 0.91, 'Pústulas de pó alaranjado na face inferior e desfolha, sinais clássicos da ferrugem.')));

  -- 4. Café, Garça: bicho-mineiro (IA em dúvida)
  c := pg_temp.chamado(produtor, 'Café',
    'Folhas com manchas marrons secas, parece queimado. Algumas soltam uma película.',
    'demo/cafe-mineiro.jpg', 3516705, 0.5);
  insert into public.sugestoes_ia (chamado_id, modelo, candidatas) values (c, modelo, jsonb_build_array(
    pg_temp.candidata('Café', 'Leucoptera coffeella', 0.55, 'Lesões marrons com epiderme que se destaca sugerem minas do bicho-mineiro.'),
    pg_temp.candidata('Café', 'Hypothenemus hampei', 0.12, 'Pouco provável: a broca ataca frutos, não folhas.')));

  -- 5. Alface, Ibiúna: míldio
  c := pg_temp.chamado(produtor, 'Alface',
    'Manchas amareladas em cima das folhas e um mofo branco embaixo.',
    'demo/alface-mildio.jpg', 3519709, 3);
  insert into public.sugestoes_ia (chamado_id, modelo, candidatas) values (c, modelo, jsonb_build_array(
    pg_temp.candidata('Alface', 'Bremia lactucae', 0.82, 'Manchas angulares amarelas com esporulação branca na face inferior: míldio.'),
    pg_temp.candidata('Alface', 'Sclerotinia sclerotiorum', 0.18, 'Mofo branco também ocorre, mas costuma atingir a base da planta.')));

  -- 6. Alface, Piedade: foto ruim (IA não identifica e explica em "observacao")
  c := pg_temp.chamado(produtor, 'Alface',
    'Alface murchando.',
    'demo/alface-escura.jpg', 3537800, 1);
  insert into public.sugestoes_ia (chamado_id, modelo, candidatas, observacao) values (c, modelo, '[]'::jsonb,
    'A foto está escura e desfocada; não é possível ver sintomas. Peça uma nova foto, de perto e com luz natural.');

  -- 7. Tomate, Holambra: IA fora do ar (o especialista segue sem a sugestão)
  c := pg_temp.chamado(produtor, 'Tomate',
    'Frutos com manchas escuras e podres perto do talo.',
    'demo/tomate-manchas.jpg', 3519055, 0.2);
  insert into public.sugestoes_ia (chamado_id, modelo, candidatas, erro) values (c, modelo, '[]'::jsonb, 'timeout');

  raise notice 'Demo recriada: 7 chamados simulados.';
end;
$$;

-- Conferência
select c.cultura, m.nome as municipio, jsonb_array_length(s.candidatas) as candidatas,
       s.erro, s.observacao is not null as tem_observacao
from public.chamados c
join public.municipios m on m.cod_ibge = c.municipio_cod
join public.sugestoes_ia s on s.chamado_id = c.id
where c.simulado
order by c.criado_em desc;
