-- ============================================================
-- QUÉX - MÓDULO 9
-- Busca sem acentos / maiúsculas em produtos
-- ============================================================
-- Execute UMA VEZ no Supabase:
-- SQL Editor -> New query -> cole tudo -> Run
--
-- Vendedores já usam nome_busca/local_busca na view perfil_publico.
-- Este módulo cria uma view equivalente para produtos, incluindo
-- nome, espécie, descrição e nome do vendedor.
-- ============================================================

begin;

create extension if not exists unaccent
  with schema extensions;

create or replace view public.produto_busca as
select
  p.*,
  lower(
    extensions.unaccent(
      concat_ws(
        ' ',
        p.nome,
        p.especie,
        p.descricao,
        v.comercial,
        u.nome
      )
    )
  ) as busca_normalizada
from public.produto p
left join public.vendedor v
  on v.id = p.vendedor_id
left join public.usuario u
  on u.id = p.vendedor_id;

revoke all
  on public.produto_busca
  from anon, authenticated;

grant select
  on public.produto_busca
  to service_role;

commit;

-- Teste opcional:
-- select id, nome, busca_normalizada
-- from public.produto_busca
-- where busca_normalizada ilike '%file%';
--
-- Um produto chamado "Filé de tilápia" deve aparecer.
