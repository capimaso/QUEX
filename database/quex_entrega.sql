BEGIN;

CREATE TABLE usuario (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    endereco TEXT NOT NULL,
    data_nasc DATE NOT NULL,
    tipo VARCHAR(20) NOT NULL
        CHECK (tipo IN ('COMPRADOR', 'VENDEDOR')),
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE comprador (
    id INTEGER PRIMARY KEY,
    cpf CHAR(11) NOT NULL UNIQUE,
    CONSTRAINT fk_comprador_usuario
        FOREIGN KEY (id)
        REFERENCES usuario(id)
        ON DELETE CASCADE
);

CREATE TABLE vendedor (
    id INTEGER PRIMARY KEY,
    cpf_cnpj VARCHAR(14) NOT NULL UNIQUE,
    nome_loja VARCHAR(150) NOT NULL,
    entrega_disponivel BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_vendedor_usuario
        FOREIGN KEY (id)
        REFERENCES usuario(id)
        ON DELETE CASCADE
);

CREATE TABLE produto (
    id SERIAL PRIMARY KEY,
    vendedor_id INTEGER NOT NULL,
    nome VARCHAR(150) NOT NULL,
    descricao TEXT,
    especie VARCHAR(100) NOT NULL,
    preco NUMERIC(10,2) NOT NULL CHECK (preco > 0),
    estoque INTEGER NOT NULL CHECK (estoque >= 0),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_produto_vendedor
        FOREIGN KEY (vendedor_id)
        REFERENCES vendedor(id)
        ON DELETE RESTRICT
);

CREATE TABLE carrinho (
    id SERIAL PRIMARY KEY,
    comprador_id INTEGER NOT NULL UNIQUE,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_carrinho_comprador
        FOREIGN KEY (comprador_id)
        REFERENCES comprador(id)
        ON DELETE CASCADE
);

CREATE TABLE item_carrinho (
    id SERIAL PRIMARY KEY,
    carrinho_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    CONSTRAINT uq_item_carrinho UNIQUE (carrinho_id, produto_id),
    CONSTRAINT fk_item_carrinho_carrinho
        FOREIGN KEY (carrinho_id)
        REFERENCES carrinho(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_item_carrinho_produto
        FOREIGN KEY (produto_id)
        REFERENCES produto(id)
        ON DELETE RESTRICT
);

CREATE TABLE pedido (
    id SERIAL PRIMARY KEY,
    comprador_id INTEGER NOT NULL,
    data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PENDENTE', 'PAGO', 'ENVIADO', 'ENTREGUE', 'CANCELADO')),
    total NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    CONSTRAINT fk_pedido_comprador
        FOREIGN KEY (comprador_id)
        REFERENCES comprador(id)
        ON DELETE RESTRICT
);

CREATE TABLE pedido_item (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL CHECK (quantidade > 0),
    preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario > 0),
    CONSTRAINT uq_pedido_item UNIQUE (pedido_id, produto_id),
    CONSTRAINT fk_pedido_item_pedido
        FOREIGN KEY (pedido_id)
        REFERENCES pedido(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pedido_item_produto
        FOREIGN KEY (produto_id)
        REFERENCES produto(id)
        ON DELETE RESTRICT
);

CREATE TABLE pagamento (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL UNIQUE,
    forma_pagamento VARCHAR(30) NOT NULL,
    valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PENDENTE', 'APROVADO', 'RECUSADO')),
    pago_em DATE,
    CONSTRAINT fk_pagamento_pedido
        FOREIGN KEY (pedido_id)
        REFERENCES pedido(id)
        ON DELETE CASCADE
);

CREATE TABLE entrega (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL UNIQUE,
    vendedor_id INTEGER NOT NULL,
    endereco_destino TEXT NOT NULL,
    data_previsao DATE NOT NULL,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PREPARANDO', 'ENVIADA', 'ENTREGUE')),
    codigo_rastreio VARCHAR(50) UNIQUE,
    CONSTRAINT fk_entrega_pedido
        FOREIGN KEY (pedido_id)
        REFERENCES pedido(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_entrega_vendedor
        FOREIGN KEY (vendedor_id)
        REFERENCES vendedor(id)
        ON DELETE RESTRICT
);

COMMIT;

-- Parte 2: DML (dados de exemplo)

BEGIN;

INSERT INTO usuario (id, nome, email, senha, telefone, endereco, data_nasc, tipo) VALUES
(1, 'Ana Costa', 'ana@exemplo.com', 'senha_ficticia_ana', '11999990001', 'Rua das Ondas, 100 - Santos/SP', DATE '2000-05-12', 'COMPRADOR'),
(2, 'Bruno Lima', 'bruno@exemplo.com', 'senha_ficticia_bruno', '11999990002', 'Avenida do Mar, 200 - Guarujá/SP', DATE '1995-08-20', 'COMPRADOR'),
(3, 'Carla Souza', 'carla@exemplo.com', 'senha_ficticia_carla', '11999990003', 'Rua do Porto, 300 - São Vicente/SP', DATE '1998-01-15', 'COMPRADOR'),
(4, 'Diego Alves', 'diego@exemplo.com', 'senha_ficticia_diego', '11999990004', 'Rua dos Pescadores, 40 - Santos/SP', DATE '1989-04-10', 'VENDEDOR'),
(5, 'Elisa Rocha', 'elisa@exemplo.com', 'senha_ficticia_elisa', '11999990005', 'Avenida da Praia, 500 - Guarujá/SP', DATE '1992-11-25', 'VENDEDOR'),
(6, 'Felipe Moraes', 'felipe@exemplo.com', 'senha_ficticia_felipe', '11999990006', 'Rua da Marina, 90 - São Vicente/SP', DATE '1987-07-08', 'VENDEDOR');

INSERT INTO comprador (id, cpf) VALUES
(1, '12345678901'),
(2, '23456789012'),
(3, '34567890123');

INSERT INTO vendedor (id, cpf_cnpj, nome_loja, entrega_disponivel) VALUES
(4, '12345678000199', 'Peixaria do Diego', TRUE),
(5, '23456789000188', 'Mariscos da Elisa', TRUE),
(6, '34567890000177', 'Pescados do Felipe', FALSE);

INSERT INTO produto (id, vendedor_id, nome, descricao, especie, preco, estoque) VALUES
(1, 4, 'Tilápia fresca', 'Filé de tilápia resfriado.', 'Tilápia', 19.90, 30),
(2, 5, 'Camarão limpo', 'Camarão limpo e congelado.', 'Camarão', 14.35, 50),
(3, 6, 'Lula em anéis', 'Lula limpa em anéis congelados.', 'Lula', 31.50, 20);

INSERT INTO carrinho (id, comprador_id) VALUES
(1, 1),
(2, 2),
(3, 3);

INSERT INTO item_carrinho (id, carrinho_id, produto_id, quantidade) VALUES
(1, 1, 1, 2),
(2, 2, 2, 1),
(3, 3, 3, 3);

INSERT INTO pedido (id, comprador_id, data_pedido, status, total) VALUES
(1, 1, DATE '2026-10-10', 'ENVIADO', 59.70),
(2, 2, DATE '2026-10-11', 'PAGO', 71.75),
(3, 3, DATE '2026-10-12', 'ENTREGUE', 63.00);

INSERT INTO pedido_item (id, pedido_id, produto_id, quantidade, preco_unitario) VALUES
(1, 1, 1, 3, 19.90),
(2, 2, 2, 5, 14.35),
(3, 3, 3, 2, 31.50);

INSERT INTO pagamento (id, pedido_id, forma_pagamento, valor, status, pago_em) VALUES
(1, 1, 'PIX', 59.70, 'APROVADO', DATE '2026-10-10'),
(2, 2, 'CARTAO', 71.75, 'APROVADO', DATE '2026-10-11'),
(3, 3, 'PIX', 63.00, 'APROVADO', DATE '2026-10-12');

INSERT INTO entrega (id, pedido_id, vendedor_id, endereco_destino, data_previsao, status, codigo_rastreio) VALUES
(1, 1, 4, 'Rua das Ondas, 100 - Santos/SP', DATE '2026-10-13', 'ENVIADA', 'QX001'),
(2, 2, 5, 'Avenida do Mar, 200 - Guarujá/SP', DATE '2026-10-14', 'PREPARANDO', 'QX002'),
(3, 3, 6, 'Rua do Porto, 300 - São Vicente/SP', DATE '2026-10-13', 'ENTREGUE', 'QX003');

SELECT setval(pg_get_serial_sequence('usuario', 'id'), (SELECT MAX(id) FROM usuario));
SELECT setval(pg_get_serial_sequence('produto', 'id'), (SELECT MAX(id) FROM produto));
SELECT setval(pg_get_serial_sequence('carrinho', 'id'), (SELECT MAX(id) FROM carrinho));
SELECT setval(pg_get_serial_sequence('item_carrinho', 'id'), (SELECT MAX(id) FROM item_carrinho));
SELECT setval(pg_get_serial_sequence('pedido', 'id'), (SELECT MAX(id) FROM pedido));
SELECT setval(pg_get_serial_sequence('pedido_item', 'id'), (SELECT MAX(id) FROM pedido_item));
SELECT setval(pg_get_serial_sequence('pagamento', 'id'), (SELECT MAX(id) FROM pagamento));
SELECT setval(pg_get_serial_sequence('entrega', 'id'), (SELECT MAX(id) FROM entrega));

COMMIT;

-- Consulta 1: produtos e seus vendedores
SELECT
    p.id,
    p.nome AS produto,
    p.especie,
    p.preco,
    u.nome AS vendedor,
    v.nome_loja
FROM produto AS p
JOIN vendedor AS v ON v.id = p.vendedor_id
JOIN usuario AS u ON u.id = v.id
ORDER BY p.id;

-- Consulta 2: pedidos, compradores e pagamentos
SELECT
    pe.id AS pedido,
    u.nome AS comprador,
    pe.status AS status_pedido,
    pe.total,
    pa.forma_pagamento,
    pa.status AS status_pagamento
FROM pedido AS pe
JOIN comprador AS c ON c.id = pe.comprador_id
JOIN usuario AS u ON u.id = c.id
JOIN pagamento AS pa ON pa.pedido_id = pe.id
ORDER BY pe.id;