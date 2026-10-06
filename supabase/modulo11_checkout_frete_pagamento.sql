-- ============================================================
-- QUÉX - MÓDULO 11
-- Checkout, pagamento mock, frete por km e taxa da plataforma
-- ============================================================
-- Migration idempotente. Não remove tabelas nem dados existentes.
-- A única constraint removida é a UNIQUE antiga de entrega.pedido_id,
-- pois o Módulo 11 passa a permitir uma entrega por vendedor no mesmo pedido.
-- ============================================================

begin;

create extension if not exists unaccent with schema extensions;

-- ------------------------------------------------------------
-- 0. PRÉ-REQUISITOS DEFENSIVOS DO MÓDULO 10
-- ------------------------------------------------------------

alter table public.usuario
  add column if not exists cep varchar(8),
  add column if not exists numero varchar(30),
  add column if not exists complemento varchar(120),
  add column if not exists cidade varchar(120),
  add column if not exists uf varchar(2);

alter table public.produto
  add column if not exists preco_promocional numeric(10,2),
  add column if not exists promocao_expira_em timestamptz;

-- ------------------------------------------------------------
-- 1. COORDENADAS + CONFIGURAÇÃO DE FRETE DO VENDEDOR
-- ------------------------------------------------------------

alter table public.usuario
  add column if not exists lat numeric(10,7),
  add column if not exists lng numeric(10,7);

alter table public.vendedor
  add column if not exists valor_por_km numeric(10,2),
  add column if not exists entrega_disponivel boolean not null default false;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_usuario_lat_mod11'
       and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint chk_usuario_lat_mod11
      check (lat is null or lat between -90 and 90);
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_usuario_lng_mod11'
       and conrelid = 'public.usuario'::regclass
  ) then
    alter table public.usuario
      add constraint chk_usuario_lng_mod11
      check (lng is null or lng between -180 and 180);
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_vendedor_valor_por_km_mod11'
       and conrelid = 'public.vendedor'::regclass
  ) then
    alter table public.vendedor
      add constraint chk_vendedor_valor_por_km_mod11
      check (valor_por_km is null or valor_por_km > 0);
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_vendedor_entrega_config_mod11'
       and conrelid = 'public.vendedor'::regclass
  ) then
    alter table public.vendedor
      add constraint chk_vendedor_entrega_config_mod11
      check (
        entrega_disponivel = false
        or (
          valor_por_km is not null
          and valor_por_km > 0
        )
      );
  end if;
end
$$;

create index if not exists ix_usuario_lat_lng
  on public.usuario (lat, lng)
  where lat is not null and lng is not null;

-- Perfil público continua sem CEP/número/coordenadas.
-- Somente cidade/UF + configuração comercial de entrega são públicas.
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
  u.uf,
  coalesce(v.entrega_disponivel, false) as entrega_disponivel,
  v.valor_por_km
from public.usuario u
left join public.vendedor v
  on v.id = u.id
left join public.avaliacao_resumo r
  on r.usuario_id = u.id
where u.is_active
  and u.tipo in ('comprador', 'vendedor');

revoke all on public.perfil_publico
  from anon, authenticated;

grant select on public.perfil_publico
  to service_role;

-- ------------------------------------------------------------
-- 2. CHECKOUT MULTI-VENDEDOR
-- ------------------------------------------------------------

alter table public.pedido
  add column if not exists subtotal_produtos numeric(12,2),
  add column if not exists valor_frete numeric(12,2) not null default 0;

alter table public.pagamento
  add column if not exists gateway_id varchar(160),
  add column if not exists link_pagamento text,
  add column if not exists data_aprovacao timestamptz;

alter table public.entrega
  add column if not exists tipo_frete varchar(20) not null default 'entrega',
  add column if not exists valor_frete numeric(12,2) not null default 0,
  add column if not exists distancia_km numeric(12,2);

do $$
declare
  item record;
begin
  -- A modelagem antiga permitia só uma linha de entrega por pedido.
  -- Remove APENAS essa constraint UNIQUE, sem apagar tabela ou dados.
  for item in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.entrega'::regclass
       and c.contype = 'u'
       and pg_get_constraintdef(c.oid) ~* '^UNIQUE \(pedido_id\)$'
  loop
    execute format(
      'alter table public.entrega drop constraint %I',
      item.conname
    );
  end loop;
end
$$;

create unique index if not exists ux_entrega_pedido_vendedor
  on public.entrega (pedido_id, vendedor_id);

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_entrega_tipo_frete_mod11'
       and conrelid = 'public.entrega'::regclass
  ) then
    alter table public.entrega
      add constraint chk_entrega_tipo_frete_mod11
      check (tipo_frete in ('retirada', 'entrega'));
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_entrega_valor_frete_mod11'
       and conrelid = 'public.entrega'::regclass
  ) then
    alter table public.entrega
      add constraint chk_entrega_valor_frete_mod11
      check (valor_frete >= 0);
  end if;

  if not exists (
    select 1
      from pg_constraint
     where conname = 'chk_entrega_distancia_mod11'
       and conrelid = 'public.entrega'::regclass
  ) then
    alter table public.entrega
      add constraint chk_entrega_distancia_mod11
      check (distancia_km is null or distancia_km >= 0);
  end if;
end
$$;

create index if not exists ix_entrega_vendedor_status
  on public.entrega (vendedor_id, status);

-- ------------------------------------------------------------
-- 3. TAXA DA PLATAFORMA
-- ------------------------------------------------------------

create table if not exists public.configuracao_plataforma (
  id serial primary key,
  taxa_percentual numeric(6,3) not null default 5.0,
  atualizado_em timestamptz not null default now(),
  constraint chk_configuracao_taxa_mod11
    check (taxa_percentual between 0 and 100)
);

insert into public.configuracao_plataforma (
  taxa_percentual,
  atualizado_em
)
select 5.0, now()
where not exists (
  select 1
    from public.configuracao_plataforma
);

create table if not exists public.receita_plataforma (
  id serial primary key,
  pedido_id integer not null,
  vendedor_id integer not null,
  valor_produto numeric(12,2) not null,
  valor_taxa numeric(12,2) not null,
  percentual_aplicado numeric(6,3) not null,
  data_criacao timestamptz not null default now(),
  constraint fk_receita_pedido_mod11
    foreign key (pedido_id)
    references public.pedido(id)
    on delete cascade,
  constraint fk_receita_vendedor_mod11
    foreign key (vendedor_id)
    references public.vendedor(id),
  constraint chk_receita_valor_produto_mod11
    check (valor_produto >= 0),
  constraint chk_receita_valor_taxa_mod11
    check (valor_taxa >= 0),
  constraint chk_receita_percentual_mod11
    check (percentual_aplicado between 0 and 100),
  constraint uq_receita_pedido_vendedor_mod11
    unique (pedido_id, vendedor_id)
);

create index if not exists ix_receita_vendedor_data
  on public.receita_plataforma (vendedor_id, data_criacao desc);

alter table public.configuracao_plataforma
  enable row level security;

alter table public.receita_plataforma
  enable row level security;

revoke all on public.configuracao_plataforma
  from anon, authenticated;

revoke all on public.receita_plataforma
  from anon, authenticated;

grant all on public.configuracao_plataforma
  to service_role;

grant all on public.receita_plataforma
  to service_role;

grant usage, select on all sequences in schema public
  to service_role;

-- ------------------------------------------------------------
-- 4. AVALIAÇÕES COMPATÍVEIS COM PEDIDO MULTI-VENDEDOR
-- ------------------------------------------------------------

do $$
declare
  item record;
begin
  for item in
    select c.conname
      from pg_constraint c
     where c.conrelid = 'public.avaliacao'::regclass
       and c.contype = 'u'
       and pg_get_constraintdef(c.oid) ~* '^UNIQUE \(pedido_id, avaliador_id\)$'
  loop
    execute format(
      'alter table public.avaliacao drop constraint %I',
      item.conname
    );
  end loop;
end
$$;

create unique index if not exists ux_avaliacao_pedido_avaliador_avaliado
  on public.avaliacao (
    pedido_id,
    avaliador_id,
    avaliado_id
  );

create or replace function public.quex_validar_avaliacao()
returns trigger
language plpgsql
as $$
declare
  v_comprador integer;
  v_status text;
begin
  select p.comprador_id, p.status
    into v_comprador, v_status
    from public.pedido p
   where p.id = new.pedido_id;

  if not found then
    raise exception 'Pedido não encontrado.';
  end if;

  if v_status <> 'entregue' then
    raise exception 'Só é possível avaliar pedidos entregues.';
  end if;

  if new.avaliador_id = v_comprador then
    if not exists (
      select 1
        from public.entrega e
       where e.pedido_id = new.pedido_id
         and e.vendedor_id = new.avaliado_id
    ) then
      raise exception 'O vendedor avaliado não participou deste pedido.';
    end if;
  elsif new.avaliado_id = v_comprador then
    if not exists (
      select 1
        from public.entrega e
       where e.pedido_id = new.pedido_id
         and e.vendedor_id = new.avaliador_id
    ) then
      raise exception 'O vendedor avaliador não participou deste pedido.';
    end if;
  else
    raise exception 'A avaliação precisa ocorrer entre comprador e vendedor do pedido.';
  end if;

  if new.avaliador_id = new.avaliado_id then
    raise exception 'Não é possível avaliar a própria conta.';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 5. CHECKOUT ATÔMICO
-- ------------------------------------------------------------

create or replace function public.criar_pedido_atomico(
  p_comprador_id integer,
  p_itens jsonb,
  p_entregas jsonb,
  p_forma_pagamento varchar,
  p_gateway_id varchar,
  p_link_pagamento text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart_id integer;
  v_buyer_address text;
  v_buyer_lat numeric;
  v_buyer_lng numeric;
  v_seller_count integer;
  v_delivery_count integer;
  v_tax_percent numeric(6,3);
  v_order_id integer;
  v_payment_id integer;
  v_product_total numeric(12,2) := 0;
  v_shipping_total numeric(12,2) := 0;
  v_grand_total numeric(12,2) := 0;

  v_json jsonb;
  v_delivery_json jsonb;

  v_product_id integer;
  v_quantity integer;
  v_seller_id integer;
  v_shipping_type varchar;
  v_distance numeric;
  v_shipping_value numeric;
  v_rate numeric;
  v_effective_price numeric;
  v_subtotal numeric;
  v_seller_product_total numeric;
  v_fee numeric;

  v_cart_quantity integer;
  v_stock integer;
  v_active boolean;
  v_original_price numeric;
  v_promotional_price numeric;
  v_promotion_expires timestamptz;
begin
  if p_comprador_id is null then
    raise exception 'Comprador inválido.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_itens) <> 'array'
     or jsonb_array_length(p_itens) = 0 then
    raise exception 'O checkout não possui itens.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_entregas) <> 'array'
     or jsonb_array_length(p_entregas) = 0 then
    raise exception 'As opções de entrega não foram informadas.' using errcode = '22023';
  end if;

  if lower(trim(coalesce(p_forma_pagamento, '')))
     not in ('pix', 'cartao') then
    raise exception 'Forma de pagamento inválida.' using errcode = '22023';
  end if;

  if coalesce(trim(p_gateway_id), '') = '' then
    raise exception 'Identificador do pagamento inválido.' using errcode = '22023';
  end if;

  select
    u.endereco,
    u.lat,
    u.lng
    into
      v_buyer_address,
      v_buyer_lat,
      v_buyer_lng
    from public.usuario u
    join public.comprador c
      on c.id = u.id
   where u.id = p_comprador_id
     and u.is_active = true
     and u.banido_em is null;

  if not found then
    raise exception 'Comprador não encontrado ou inativo.' using errcode = '23503';
  end if;

  if v_buyer_lat is null or v_buyer_lng is null then
    raise exception 'O endereço do comprador não possui coordenadas.' using errcode = '22023';
  end if;

  if coalesce(btrim(v_buyer_address), '') = '' then
    raise exception 'O comprador não possui endereço completo.' using errcode = '22023';
  end if;

  select id
    into v_cart_id
    from public.carrinho
   where comprador_id = p_comprador_id
   for update;

  if v_cart_id is null then
    raise exception 'Carrinho não encontrado.' using errcode = 'P0001';
  end if;

  if (
    select count(*)
      from public.item_carrinho
     where carrinho_id = v_cart_id
  ) <> jsonb_array_length(p_itens) then
    raise exception 'O carrinho mudou. Atualize o checkout.' using errcode = 'P0001';
  end if;

  select count(distinct p.vendedor_id)
    into v_seller_count
    from public.item_carrinho ic
    join public.produto p
      on p.id = ic.produto_id
   where ic.carrinho_id = v_cart_id;

  if v_seller_count <= 0 then
    raise exception 'Seu carrinho está vazio.' using errcode = 'P0001';
  end if;

  if jsonb_array_length(p_entregas) <> v_seller_count then
    raise exception 'Escolha uma opção de entrega para cada vendedor.' using errcode = '22023';
  end if;

  select count(*)
    into v_delivery_count
    from (
      select distinct (item->>'vendedor_id')::integer
        from jsonb_array_elements(p_entregas) item
    ) choices;

  if v_delivery_count <> v_seller_count then
    raise exception 'As opções de entrega possuem vendedores duplicados ou ausentes.' using errcode = '22023';
  end if;

  -- Validação e recálculo de cada item com os preços atuais do banco.
  for v_json in
    select value
      from jsonb_array_elements(p_itens)
  loop
    v_product_id := nullif(v_json->>'produto_id', '')::integer;
    v_quantity := nullif(v_json->>'quantidade', '')::integer;

    if v_product_id is null
       or v_quantity is null
       or v_quantity <= 0 then
      raise exception 'Item de checkout inválido.' using errcode = '22023';
    end if;

    select
      ic.quantidade,
      p.quantidade,
      p.ativo,
      p.preco,
      p.preco_promocional,
      p.promocao_expira_em
      into
        v_cart_quantity,
        v_stock,
        v_active,
        v_original_price,
        v_promotional_price,
        v_promotion_expires
      from public.item_carrinho ic
      join public.produto p
        on p.id = ic.produto_id
     where ic.carrinho_id = v_cart_id
       and ic.produto_id = v_product_id
     for update of ic, p;

    if not found then
      raise exception 'Um item não pertence ao seu carrinho.' using errcode = 'P0001';
    end if;

    if v_cart_quantity <> v_quantity then
      raise exception 'A quantidade de um item mudou. Atualize o checkout.' using errcode = 'P0001';
    end if;

    if not v_active then
      raise exception 'Um produto não está mais disponível.' using errcode = 'P0001';
    end if;

    if v_quantity > v_stock then
      raise exception 'Estoque insuficiente para um dos produtos.' using errcode = 'P0001';
    end if;

    v_effective_price :=
      case
        when v_promotional_price is not null
         and v_promotion_expires is not null
         and v_promotion_expires > current_timestamp
         and v_promotional_price > 0
         and v_promotional_price < v_original_price
        then v_promotional_price
        else v_original_price
      end;

    v_product_total :=
      v_product_total +
      round((v_quantity * v_effective_price)::numeric, 2);
  end loop;

  -- Validação e recálculo de frete usando a distância confiável obtida
  -- pelo backend via OpenRouteService e a tarifa ATUAL do vendedor no banco.
  for v_delivery_json in
    select value
      from jsonb_array_elements(p_entregas)
  loop
    v_seller_id :=
      nullif(v_delivery_json->>'vendedor_id', '')::integer;

    v_shipping_type :=
      lower(trim(coalesce(v_delivery_json->>'tipo_frete', '')));

    if v_seller_id is null
       or v_shipping_type not in ('retirada', 'entrega') then
      raise exception 'Opção de entrega inválida.' using errcode = '22023';
    end if;

    if not exists (
      select 1
        from public.item_carrinho ic
        join public.produto p
          on p.id = ic.produto_id
       where ic.carrinho_id = v_cart_id
         and p.vendedor_id = v_seller_id
    ) then
      raise exception 'Vendedor inválido para este carrinho.' using errcode = '22023';
    end if;

    if v_shipping_type = 'entrega' then
      select valor_por_km
        into v_rate
        from public.vendedor
       where id = v_seller_id
         and entrega_disponivel = true
         and valor_por_km > 0;

      if not found then
        raise exception 'Um vendedor não oferece mais entrega.' using errcode = 'P0001';
      end if;

      if not exists (
        select 1
          from public.usuario u
         where u.id = v_seller_id
           and u.lat is not null
           and u.lng is not null
      ) then
        raise exception 'O endereço de um vendedor não possui coordenadas.' using errcode = 'P0001';
      end if;

      v_distance :=
        nullif(v_delivery_json->>'distancia_km', '')::numeric;

      if v_distance is null or v_distance <= 0 then
        raise exception 'Distância de entrega inválida.' using errcode = '22023';
      end if;

      v_shipping_value :=
        round((v_distance * v_rate)::numeric, 2);

      v_shipping_total :=
        v_shipping_total + v_shipping_value;
    end if;
  end loop;

  select taxa_percentual
    into v_tax_percent
    from public.configuracao_plataforma
   order by id asc
   limit 1;

  v_tax_percent := coalesce(v_tax_percent, 5.0);
  v_product_total := round(v_product_total, 2);
  v_shipping_total := round(v_shipping_total, 2);
  v_grand_total := round(v_product_total + v_shipping_total, 2);

  insert into public.pedido (
    comprador_id,
    status,
    data_criacao,
    subtotal_produtos,
    valor_frete,
    valor_total
  )
  values (
    p_comprador_id,
    'aguardando_pagamento',
    current_timestamp,
    v_product_total,
    v_shipping_total,
    v_grand_total
  )
  returning id into v_order_id;

  -- Itens + baixa de estoque, ainda dentro da mesma transação.
  for v_json in
    select value
      from jsonb_array_elements(p_itens)
  loop
    v_product_id := (v_json->>'produto_id')::integer;
    v_quantity := (v_json->>'quantidade')::integer;

    select
      p.preco,
      p.preco_promocional,
      p.promocao_expira_em
      into
        v_original_price,
        v_promotional_price,
        v_promotion_expires
      from public.produto p
     where p.id = v_product_id;

    v_effective_price :=
      case
        when v_promotional_price is not null
         and v_promotion_expires is not null
         and v_promotion_expires > current_timestamp
         and v_promotional_price > 0
         and v_promotional_price < v_original_price
        then v_promotional_price
        else v_original_price
      end;

    v_subtotal :=
      round((v_quantity * v_effective_price)::numeric, 2);

    insert into public.pedido_item (
      pedido_id,
      produto_id,
      quantidade,
      preco_unitario,
      subtotal
    )
    values (
      v_order_id,
      v_product_id,
      v_quantity,
      v_effective_price,
      v_subtotal
    );

    update public.produto
       set quantidade = quantidade - v_quantity
     where id = v_product_id;
  end loop;

  -- Uma entrega/retirada por vendedor.
  for v_delivery_json in
    select value
      from jsonb_array_elements(p_entregas)
  loop
    v_seller_id := (v_delivery_json->>'vendedor_id')::integer;
    v_shipping_type := lower(v_delivery_json->>'tipo_frete');

    if v_shipping_type = 'entrega' then
      select valor_por_km
        into v_rate
        from public.vendedor
       where id = v_seller_id;

      v_distance :=
        (v_delivery_json->>'distancia_km')::numeric;

      v_shipping_value :=
        round((v_distance * v_rate)::numeric, 2);
    else
      v_distance := null;
      v_shipping_value := 0;
    end if;

    insert into public.entrega (
      pedido_id,
      vendedor_id,
      endereco_destino,
      data_agendada,
      codigo_rastreio,
      status,
      via_food,
      tipo_frete,
      valor_frete,
      distancia_km
    )
    values (
      v_order_id,
      v_seller_id,
      case
        when v_shipping_type = 'entrega'
        then v_buyer_address
        else 'Retirada em mãos'
      end,
      null,
      null,
      'aguardando_pagamento',
      false,
      v_shipping_type,
      v_shipping_value,
      v_distance
    );
  end loop;

  -- Taxa por vendedor. Ela é RETIDA do vendedor e não adicionada ao comprador.
  for v_seller_id in
    select distinct p.vendedor_id
      from public.item_carrinho ic
      join public.produto p
        on p.id = ic.produto_id
     where ic.carrinho_id = v_cart_id
  loop
    select
      round(
        sum(
          ic.quantidade *
          case
            when p.preco_promocional is not null
             and p.promocao_expira_em is not null
             and p.promocao_expira_em > current_timestamp
             and p.preco_promocional > 0
             and p.preco_promocional < p.preco
            then p.preco_promocional
            else p.preco
          end
        )::numeric,
        2
      )
      into v_seller_product_total
      from public.item_carrinho ic
      join public.produto p
        on p.id = ic.produto_id
     where ic.carrinho_id = v_cart_id
       and p.vendedor_id = v_seller_id;

    v_seller_product_total :=
      coalesce(v_seller_product_total, 0);

    v_fee :=
      round(
        (
          v_seller_product_total *
          (v_tax_percent / 100)
        )::numeric,
        2
      );

    insert into public.receita_plataforma (
      pedido_id,
      vendedor_id,
      valor_produto,
      valor_taxa,
      percentual_aplicado,
      data_criacao
    )
    values (
      v_order_id,
      v_seller_id,
      v_seller_product_total,
      v_fee,
      v_tax_percent,
      current_timestamp
    );
  end loop;

  insert into public.pagamento (
    pedido_id,
    forma_pagamento,
    valor,
    data_pagamento,
    status,
    gateway_id,
    link_pagamento,
    data_aprovacao
  )
  values (
    v_order_id,
    lower(trim(p_forma_pagamento)),
    v_grand_total,
    null,
    'pendente',
    trim(p_gateway_id),
    p_link_pagamento,
    null
  )
  returning id into v_payment_id;

  delete from public.item_carrinho
   where carrinho_id = v_cart_id;

  update public.carrinho
     set valor_total = 0
   where id = v_cart_id;

  return jsonb_build_object(
    'id', v_order_id,
    'comprador_id', p_comprador_id,
    'status', 'aguardando_pagamento',
    'subtotal_produtos', v_product_total,
    'valor_frete', v_shipping_total,
    'valor_total', v_grand_total,
    'pagamento_id', v_payment_id
  );
end;
$$;

revoke execute
  on function public.criar_pedido_atomico(integer, jsonb, jsonb, varchar, varchar, text)
  from public, anon, authenticated;

grant execute
  on function public.criar_pedido_atomico(integer, jsonb, jsonb, varchar, varchar, text)
  to service_role;

-- ------------------------------------------------------------
-- 6. CONFIRMAÇÃO ATÔMICA DO PAGAMENTO MOCK
-- ------------------------------------------------------------

create or replace function public.confirmar_pagamento_mock(
  p_pedido_id integer,
  p_comprador_id integer,
  p_gateway_id varchar
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_order record;
begin
  select *
    into v_order
    from public.pedido
   where id = p_pedido_id
     and comprador_id = p_comprador_id
   for update;

  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;

  select *
    into v_payment
    from public.pagamento
   where pedido_id = p_pedido_id
     and gateway_id = p_gateway_id
   for update;

  if not found then
    raise exception 'Pagamento não encontrado.' using errcode = 'P0001';
  end if;

  if v_payment.status = 'aprovado' then
    return jsonb_build_object(
      'pedido_id', p_pedido_id,
      'gateway_id', p_gateway_id,
      'status', 'aprovado'
    );
  end if;

  if v_payment.status <> 'pendente' then
    raise exception 'Este pagamento não está pendente.' using errcode = 'P0001';
  end if;

  if v_order.status <> 'aguardando_pagamento' then
    raise exception 'O pedido não está aguardando pagamento.' using errcode = 'P0001';
  end if;

  update public.pagamento
     set status = 'aprovado',
         data_aprovacao = current_timestamp,
         data_pagamento = current_timestamp
   where id = v_payment.id;

  update public.pedido
     set status = 'em_preparo'
   where id = p_pedido_id;

  update public.entrega
     set status = 'em_preparo'
   where pedido_id = p_pedido_id;

  return jsonb_build_object(
    'pedido_id', p_pedido_id,
    'gateway_id', p_gateway_id,
    'status', 'aprovado',
    'pedido_status', 'em_preparo',
    'aprovado_em', current_timestamp
  );
end;
$$;

revoke execute
  on function public.confirmar_pagamento_mock(integer, integer, varchar)
  from public, anon, authenticated;

grant execute
  on function public.confirmar_pagamento_mock(integer, integer, varchar)
  to service_role;

commit;

notify pgrst, 'reload schema';
