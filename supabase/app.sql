-- =====================================================
-- QUÉX - COMPLEMENTO DO BANCO EXISTENTE
-- =====================================================
-- Este arquivo NÃO recria as tabelas do projeto.
-- Execute depois do SQL base do QUÉX que já existe no seu Supabase.
--
-- O front-end usa as tabelas:
-- usuario, comprador, vendedor, produto, carrinho,
-- item_carrinho, pedido, pedido_item, pagamento e entrega.
--
-- A função abaixo faz o checkout em uma única transação,
-- incluindo validação de estoque, criação do pedido,
-- pagamento, entrega, baixa do estoque e limpeza do carrinho.
-- =====================================================

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

    if not exists (select 1 from comprador where id = p_comprador_id) then
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

    if not exists (select 1 from item_carrinho where carrinho_id = v_cart_id) then
        raise exception 'Seu carrinho está vazio.' using errcode = 'P0001';
    end if;

    select count(distinct p.vendedor_id), min(p.vendedor_id)
      into v_seller_count, v_seller_id
      from item_carrinho ic
      join produto p on p.id = ic.produto_id
     where ic.carrinho_id = v_cart_id;

    if v_seller_count <> 1 then
        raise exception 'O carrinho deve conter produtos de um único vendedor por pedido.' using errcode = 'P0001';
    end if;

    -- Bloqueia os itens/produtos enquanto valida estoque e grava o pedido.
    for v_item in
        select
            ic.id as item_id,
            ic.produto_id,
            ic.quantidade as quantidade_carrinho,
            p.quantidade as estoque,
            p.preco,
            p.ativo,
            p.vendedor_id
        from item_carrinho ic
        join produto p on p.id = ic.produto_id
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

        v_total := v_total + (v_item.quantidade_carrinho * v_item.preco);
    end loop;

    insert into pedido (comprador_id, status, data_criacao, valor_total)
    values (p_comprador_id, 'pendente', current_timestamp, v_total)
    returning id into v_order_id;

    for v_item in
        select
            ic.produto_id,
            ic.quantidade,
            p.preco
        from item_carrinho ic
        join produto p on p.id = ic.produto_id
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
            v_item.preco,
            (v_item.quantidade * v_item.preco)
        );

        update produto
           set quantidade = quantidade - v_item.quantidade
         where id = v_item.produto_id;
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

grant execute on function public.quex_finalizar_checkout(integer, varchar, varchar) to anon, authenticated, service_role;
