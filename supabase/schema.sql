-- =====================================================
-- QUÉX - MERCADO ONLINE DE PEIXE
-- Banco de dados PostgreSQL
-- =====================================================

CREATE TABLE usuario (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    senha VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    endereco VARCHAR(255),
    data_nasc DATE,
    tipo VARCHAR(20) NOT NULL
);

CREATE TABLE comprador (
    id INTEGER PRIMARY KEY,
    cpf VARCHAR(14) NOT NULL UNIQUE,
    CONSTRAINT fk_comprador_usuario FOREIGN KEY (id) REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE vendedor (
    id INTEGER PRIMARY KEY,
    comercial VARCHAR(150),
    entrega_propria BOOLEAN NOT NULL DEFAULT FALSE,
    cpf_cnpj VARCHAR(18) NOT NULL UNIQUE,
    localizacao VARCHAR(255),
    CONSTRAINT fk_vendedor_usuario FOREIGN KEY (id) REFERENCES usuario(id) ON DELETE CASCADE
);

CREATE TABLE produto (
    id SERIAL PRIMARY KEY,
    vendedor_id INTEGER NOT NULL,
    nome VARCHAR(150) NOT NULL,
    preco DECIMAL(10,2) NOT NULL,
    descricao TEXT,
    quantidade INTEGER NOT NULL DEFAULT 0,
    fotos_url TEXT,
    especie VARCHAR(100),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    tem_espinha BOOLEAN NOT NULL DEFAULT FALSE,
    tipo_agua VARCHAR(20) NOT NULL,
    unidade VARCHAR(20) NOT NULL,
    CONSTRAINT fk_produto_vendedor FOREIGN KEY (vendedor_id) REFERENCES vendedor(id) ON DELETE CASCADE,
    CONSTRAINT chk_produto_preco CHECK (preco >= 0),
    CONSTRAINT chk_produto_quantidade CHECK (quantidade >= 0),
    CONSTRAINT chk_produto_tipo_agua CHECK (tipo_agua IN ('doce', 'salgada'))
);

CREATE TABLE carrinho (
    id SERIAL PRIMARY KEY,
    comprador_id INTEGER NOT NULL UNIQUE,
    valor_total DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT fk_carrinho_comprador FOREIGN KEY (comprador_id) REFERENCES comprador(id) ON DELETE CASCADE,
    CONSTRAINT chk_carrinho_valor CHECK (valor_total >= 0)
);

CREATE TABLE item_carrinho (
    id SERIAL PRIMARY KEY,
    carrinho_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_item_carrinho_carrinho FOREIGN KEY (carrinho_id) REFERENCES carrinho(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_carrinho_produto FOREIGN KEY (produto_id) REFERENCES produto(id) ON DELETE CASCADE,
    CONSTRAINT chk_item_carrinho_quantidade CHECK (quantidade > 0),
    CONSTRAINT chk_item_carrinho_subtotal CHECK (subtotal >= 0)
);

CREATE TABLE pedido (
    id SERIAL PRIMARY KEY,
    comprador_id INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor_total DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_pedido_comprador FOREIGN KEY (comprador_id) REFERENCES comprador(id),
    CONSTRAINT chk_pedido_valor CHECK (valor_total >= 0)
);

CREATE TABLE pedido_item (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_pedido_item_pedido FOREIGN KEY (pedido_id) REFERENCES pedido(id) ON DELETE CASCADE,
    CONSTRAINT fk_pedido_item_produto FOREIGN KEY (produto_id) REFERENCES produto(id),
    CONSTRAINT chk_pedido_item_quantidade CHECK (quantidade > 0),
    CONSTRAINT chk_pedido_item_preco CHECK (preco_unitario >= 0),
    CONSTRAINT chk_pedido_item_subtotal CHECK (subtotal >= 0)
);

CREATE TABLE pagamento (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL UNIQUE,
    forma_pagamento VARCHAR(30) NOT NULL,
    valor DECIMAL(10,2) NOT NULL,
    data_pagamento TIMESTAMP,
    status VARCHAR(30) NOT NULL,
    CONSTRAINT fk_pagamento_pedido FOREIGN KEY (pedido_id) REFERENCES pedido(id) ON DELETE CASCADE,
    CONSTRAINT chk_pagamento_valor CHECK (valor >= 0)
);

CREATE TABLE entrega (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL UNIQUE,
    vendedor_id INTEGER NOT NULL,
    endereco_destino VARCHAR(255) NOT NULL,
    data_agendada TIMESTAMP,
    codigo_rastreio VARCHAR(100),
    status VARCHAR(30) NOT NULL,
    via_food BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT fk_entrega_pedido FOREIGN KEY (pedido_id) REFERENCES pedido(id) ON DELETE CASCADE,
    CONSTRAINT fk_entrega_vendedor FOREIGN KEY (vendedor_id) REFERENCES vendedor(id)
);
