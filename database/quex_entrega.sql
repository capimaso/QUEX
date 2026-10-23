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