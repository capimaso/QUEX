-- =====================================================
-- QUÉX - endurecimento opcional do banco
-- =====================================================
-- O front do QUÉX não acessa as tabelas diretamente do navegador.
-- Todas as operações passam pelas funções serverless da Vercel,
-- que usam a service role key no servidor.
--
-- Por isso, deixar RLS habilitado sem políticas públicas evita
-- que a chave anon/publishable ou clientes externos leiam as tabelas.
-- A service role key continua podendo operar normalmente.
-- =====================================================

alter table if exists public.usuario enable row level security;
alter table if exists public.comprador enable row level security;
alter table if exists public.vendedor enable row level security;
alter table if exists public.produto enable row level security;
alter table if exists public.carrinho enable row level security;
alter table if exists public.item_carrinho enable row level security;
alter table if exists public.pedido enable row level security;
alter table if exists public.pedido_item enable row level security;
alter table if exists public.pagamento enable row level security;
alter table if exists public.entrega enable row level security;

create unique index if not exists ux_item_carrinho_produto
    on public.item_carrinho (carrinho_id, produto_id);

create index if not exists ix_produto_vendedor on public.produto(vendedor_id);
create index if not exists ix_produto_ativo on public.produto(ativo);
create index if not exists ix_produto_nome on public.produto(nome);
create index if not exists ix_pedido_comprador on public.pedido(comprador_id);
create index if not exists ix_pedido_item_pedido on public.pedido_item(pedido_id);
create index if not exists ix_entrega_vendedor on public.entrega(vendedor_id);
