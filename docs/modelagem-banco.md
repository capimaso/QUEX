# Modelagem do banco de dados — QUÉX

## Modelagem conceitual

Entidades principais: usuário, comprador, vendedor, produto, carrinho,
item_carrinho, pedido, pedido_item, pagamento e entrega.

## Relacionamentos

- Usuário → Comprador: 1:1.
- Usuário → Vendedor: 1:1.
- Vendedor → Produto: 1:N.
- Comprador → Carrinho: 1:1.
- Carrinho → Item_carrinho: 1:N.
- Produto → Item_carrinho: 1:N.
- Comprador → Pedido: 1:N.
- Pedido → Pedido_item: 1:N.
- Produto → Pedido_item: 1:N.
- Pedido → Pagamento: 1:1.
- Pedido → Entrega: 1:0..1.
- Vendedor → Entrega: 1:N.

As tabelas `item_carrinho` e `pedido_item` funcionam como tabelas de junção
para resolver relacionamentos muitos-para-muitos.

## Modelagem lógica

As tabelas, colunas, tipos, chaves primárias, chaves estrangeiras e campos
obrigatórios estão definidos no arquivo `database/quex_entrega.sql`.

## Diagrama

![DER do QUÉX](der-quex.png)