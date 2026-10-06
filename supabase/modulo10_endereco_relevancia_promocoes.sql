-- ============================================================
-- QUÉX - MÓDULO 10
-- Endereço completo, relevância e promoções
-- ============================================================
-- Idempotente e compatível com o banco existente.
-- Não apaga dados nem remove tabelas existentes.
--
-- Execute UMA VEZ no Supabase:
-- SQL Editor -> New query -> cole tudo -> Run
-- ============================================================

begin;

create extension if not exists unaccent
  with schema extensions;

-- ------------------------------------------------------------
-- 1. ENDEREÇO COMPLETO
-- ------------------------------------------------------------

alter table public.usuario
  add column if not exists cep varchar(8),
  add column if not exists numero varchar(30),
  add column if not exists complemento varchar(120),
  add column if not exists cidade varchar(120),
  add column if not exists uf varchar(2);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_usuario_cep_mod10'
       and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint chk_usuario_cep_mod10
      check (
        cep is null
        or cep ~ '^[0-9]{8}$'
      );
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_usuario_numero_mod10'
       and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint chk_usuario_numero_mod10
      check (
        numero is null
        or btrim(numero) <> ''
      );
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_usuario_uf_mod10'
       and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint chk_usuario_uf_mod10
      check (
        uf is null
        or uf ~ '^[A-Z]{2}$'
      );
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_usuario_endereco_completo_mod10'
       and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint chk_usuario_endereco_completo_mod10
      check (
        cep is null
        or (
          numero is not null
          and btrim(numero) <> ''
          and cidade is not null
          and btrim(cidade) <> ''
          and uf is not null
          and uf ~ '^[A-Z]{2}$'
        )
      );
  end if;
end
$$;

create index if not exists ix_usuario_cidade_uf
  on public.usuario (uf, cidade);

-- A view pública mostra SOMENTE cidade e UF.
-- CEP, número, complemento e endereco NÃO entram nela.
create or replace view public.perfil_publico as
select
  u.id,
  u.tipo,
  u.nome,
  nullif(btrim(v.comercial), '') as comercial,
  coalesce(
    nullif(btrim(v.comercial), ''),
    u.nome
  ) as nome_exibicao,
  u.bio,
  u.foto_perfil,
  case
    when coalesce(btrim(u.cidade), '') <> ''
     and coalesce(btrim(u.uf), '') <> ''
    then btrim(u.cidade) || ' - ' || upper(btrim(u.uf))
    else null::text
  end as localizacao,
  r.media,
  coalesce(r.total, 0) as total,
  lower(
    extensions.unaccent(
      concat_ws(' ', u.nome, v.comercial)
    )
  ) as nome_busca,
  lower(
    extensions.unaccent(
      concat_ws(' ', u.cidade, u.uf)
    )
  ) as local_busca,
  u.cidade,
  u.uf
from public.usuario u
left join public.vendedor v
  on v.id = u.id
left join public.avaliacao_resumo r
  on r.usuario_id = u.id
where u.is_active
  and u.tipo in ('comprador', 'vendedor');

revoke all
  on public.perfil_publico
  from anon, authenticated;

grant select
  on public.perfil_publico
  to service_role;

-- ------------------------------------------------------------
-- 2. PROMOÇÕES
-- ------------------------------------------------------------

alter table public.produto
  add column if not exists preco_promocional numeric(10,2),
  add column if not exists promocao_expira_em timestamptz;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_produto_promocao_mod10'
       and conrelid = 'public.produto'::regclass
  ) then
    alter table public.produto
      add constraint chk_produto_promocao_mod10
      check (
        (
          preco_promocional is null
          and promocao_expira_em is null
        )
        or
        (
          preco_promocional is not null
          and promocao_expira_em is not null
          and preco_promocional > 0
          and preco_promocional < preco
        )
      );
  end if;
end
$$;

create index if not exists ix_produto_promocao_expira
  on public.produto (promocao_expira_em)
  where preco_promocional is not null;

-- Nova view de busca. Mantemos produto_busca antiga intacta
-- para não quebrar instalações anteriores do Módulo 9.
create or replace view public.produto_busca_v2 as
select
  p.id,
  p.vendedor_id,
  p.nome,
  p.preco,
  p.descricao,
  p.quantidade,
  p.fotos_url,
  p.especie,
  p.ativo,
  p.tem_espinha,
  p.tipo_agua,
  p.unidade,
  p.especie_id,
  p.preco_promocional,
  p.promocao_expira_em,
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
  on public.produto_busca_v2
  from anon, authenticated;

grant select
  on public.produto_busca_v2
  to service_role;

-- ------------------------------------------------------------
-- 3. CHECKOUT COM PREÇO PROMOCIONAL
-- ------------------------------------------------------------
-- O preço é revalidado no momento da compra.
-- Promoção expirada volta automaticamente ao preço original.
-- A função continua sendo chamada SOMENTE pela API serverless.

create or replace function public.quex_finalizar_checkout(
    p_comprador_id integer,
    p_endereco_destino varchar,
    p_forma_pagamento varchar
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cart_id integer;
    v_order_id integer;
    v_delivery_id integer;
    v_payment_id integer;
    v_total numeric(10,2) := 0;
    v_seller_id integer;
    v_seller_count integer;
    v_item record;
begin
    if p_comprador_id is null then
        raise exception 'Comprador inválido.' using errcode = '22023';
    end if;

    if coalesce(trim(p_endereco_destino), '') = '' then
        raise exception 'Endereço de entrega é obrigatório.' using errcode = '22023';
    end if;

    if lower(trim(coalesce(p_forma_pagamento, ''))) not in ('pix', 'cartao', 'dinheiro') then
        raise exception 'Forma de pagamento inválida.' using errcode = '22023';
    end if;

    if not exists (
      select 1
        from comprador
       where id = p_comprador_id
    ) then
        raise exception 'Comprador não encontrado.' using errcode = '23503';
    end if;

    select id
      into v_cart_id
      from carrinho
     where comprador_id = p_comprador_id
     for update;

    if v_cart_id is null then
        raise exception 'Carrinho não encontrado.' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
        from item_carrinho
       where carrinho_id = v_cart_id
    ) then
        raise exception 'Seu carrinho está vazio.' using errcode = 'P0001';
    end if;

    select
      count(distinct p.vendedor_id),
      min(p.vendedor_id)
      into v_seller_count, v_seller_id
      from item_carrinho ic
      join produto p
        on p.id = ic.produto_id
     where ic.carrinho_id = v_cart_id;

    if v_seller_count <> 1 then
        raise exception 'O carrinho deve conter produtos de um único vendedor por pedido.' using errcode = 'P0001';
    end if;

    for v_item in
        select
            ic.id as item_id,
            ic.produto_id,
            ic.quantidade as quantidade_carrinho,
            p.quantidade as estoque,
            case
              when p.preco_promocional is not null
               and p.promocao_expira_em is not null
               and p.promocao_expira_em > current_timestamp
               and p.preco_promocional > 0
               and p.preco_promocional < p.preco
              then p.preco_promocional
              else p.preco
            end as preco_efetivo,
            p.ativo,
            p.vendedor_id
        from item_carrinho ic
        join produto p
          on p.id = ic.produto_id
        where ic.carrinho_id = v_cart_id
        order by ic.id
        for update of ic, p
    loop
        if not v_item.ativo then
            raise exception 'O produto % não está mais disponível.', v_item.produto_id using errcode = 'P0001';
        end if;

        if v_item.quantidade_carrinho <= 0 then
            raise exception 'Quantidade inválida para o produto %.', v_item.produto_id using errcode = '22023';
        end if;

        if v_item.quantidade_carrinho > v_item.estoque then
            raise exception 'Estoque insuficiente para o produto %.', v_item.produto_id using errcode = 'P0001';
        end if;

        v_total :=
          v_total +
          (
            v_item.quantidade_carrinho *
            v_item.preco_efetivo
          );
    end loop;

    insert into pedido (
        comprador_id,
        status,
        data_criacao,
        valor_total
    )
    values (
        p_comprador_id,
        'pendente',
        current_timestamp,
        v_total
    )
    returning id into v_order_id;

    for v_item in
        select
            ic.produto_id,
            ic.quantidade,
            case
              when p.preco_promocional is not null
               and p.promocao_expira_em is not null
               and p.promocao_expira_em > current_timestamp
               and p.preco_promocional > 0
               and p.preco_promocional < p.preco
              then p.preco_promocional
              else p.preco
            end as preco_efetivo
        from item_carrinho ic
        join produto p
          on p.id = ic.produto_id
        where ic.carrinho_id = v_cart_id
        order by ic.id
    loop
        insert into pedido_item (
            pedido_id,
            produto_id,
            quantidade,
            preco_unitario,
            subtotal
        )
        values (
            v_order_id,
            v_item.produto_id,
            v_item.quantidade,
            v_item.preco_efetivo,
            (
              v_item.quantidade *
              v_item.preco_efetivo
            )
        );

        update produto
           set quantidade =
             quantidade -
             v_item.quantidade
         where id =
           v_item.produto_id;
    end loop;

    insert into pagamento (
        pedido_id,
        forma_pagamento,
        valor,
        data_pagamento,
        status
    )
    values (
        v_order_id,
        lower(trim(p_forma_pagamento)),
        v_total,
        null,
        'pendente'
    )
    returning id into v_payment_id;

    insert into entrega (
        pedido_id,
        vendedor_id,
        endereco_destino,
        data_agendada,
        codigo_rastreio,
        status,
        via_food
    )
    values (
        v_order_id,
        v_seller_id,
        trim(p_endereco_destino),
        null,
        null,
        'pendente',
        false
    )
    returning id into v_delivery_id;

    delete from item_carrinho
     where carrinho_id = v_cart_id;

    update carrinho
       set valor_total = 0
     where id = v_cart_id;

    return jsonb_build_object(
        'id', v_order_id,
        'comprador_id', p_comprador_id,
        'status', 'pendente',
        'valor_total', v_total,
        'pagamento_id', v_payment_id,
        'entrega_id', v_delivery_id
    );
end;
$$;

-- Regra de Ouro: checkout sensível apenas via backend/service role.
revoke execute
  on function public.quex_finalizar_checkout(integer, varchar, varchar)
  from public, anon, authenticated;

grant execute
  on function public.quex_finalizar_checkout(integer, varchar, varchar)
  to service_role;

commit;
