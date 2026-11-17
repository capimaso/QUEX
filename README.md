# QUÉX — Marketplace de Pescados

O QUÉX conecta vendedores de pescados a compradores. O repositório contém a aplicação React/Vite e uma API Node.js/Express que usa PostgreSQL.

## Executar localmente

1. Instale Node.js e PostgreSQL e crie o banco usando [`database/quex_entrega.sql`](./database/quex_entrega.sql).
2. Crie `.env` na raiz:

   ```env
   DATABASE_URL=postgresql://usuario:senha@localhost:5432/quex
   JWT_SECRET=uma-chave-secreta-longa
   PORT=3000
   FRONTEND_URL=http://localhost:5173
   ```

3. Instale as dependências e inicie a API:

   ```bash
   npm install
   npm start
   ```

4. Em outro terminal, crie `.env.local` na raiz do front-end:

   ```env
   VITE_API_URL=http://localhost:3000
   ```

5. Inicie o front-end com `npm run dev:front` e abra a URL indicada pelo Vite.

No deploy, defina `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL` e `VITE_API_URL` nos serviços correspondentes. `VITE_API_URL` deve ser a URL pública da API Render, sem barra final. Reinicie o build do front-end depois de alterar variáveis `VITE_`.

## Autenticação

Todas as respostas usam JSON. O token JWT expira em 24 horas.

### `POST /api/auth/register`

Campos obrigatórios para comprador: `nome`, `email`, `senha`, `telefone`, `endereco`, `data_nasc`, `tipo` (`COMPRADOR`) e `cpf`.

Para vendedor, use `tipo: "VENDEDOR"`, `cpf_cnpj` e, opcionalmente, `nome_loja` e `entrega_disponivel`. A API cria o perfil de comprador ou vendedor junto com o usuário.

```json
{
  "nome": "Ana Costa",
  "email": "ana@example.com",
  "senha": "senha-segura",
  "telefone": "48999990000",
  "endereco": "Rua do Porto, 10 - Centro - Florianópolis/SC",
  "data_nasc": "1998-05-12",
  "tipo": "COMPRADOR",
  "cpf": "12345678901"
}
```

Sucesso: `201 Created`, com `user` e `usuario`. E-mail duplicado ou dados inválidos retornam `400`.

### `POST /api/auth/login`

Campos obrigatórios: `email` e `password`.

```json
{
  "email": "ana@example.com",
  "password": "senha-segura"
}
```

Sucesso: `200 OK`, com `token` e `user`. Credenciais inválidas retornam `401`.

### `GET /api/auth/me`

Requer `Authorization: Bearer <token>`. Retorna o usuário autenticado. Token ausente, inválido ou expirado retorna `401`.

## Produtos

`GET /api/produtos` lista produtos e `GET /api/produtos/:id` busca um produto. Essas consultas são públicas.

Criar, atualizar e remover produtos exigem token de vendedor (`Authorization: Bearer <token>`). O `vendedor_id` é obtido do token; o servidor não aceita alterar produtos de outro vendedor.

| Método | Caminho | Campos do corpo |
| --- | --- | --- |
| `POST` | `/api/produtos` | `nome`, `especie`, `preco`, `estoque`; `descricao` e `ativo` são opcionais |
| `PUT` | `/api/produtos/:id` | `nome`, `especie`, `preco`, `estoque`; `descricao` e `ativo` são opcionais |
| `DELETE` | `/api/produtos/:id` | — |

Exemplo de criação:

```json
{
  "nome": "Tilápia fresca",
  "descricao": "Pescado resfriado.",
  "especie": "Tilápia",
  "preco": 28.9,
  "estoque": 12,
  "ativo": true
}
```

Sucesso retorna o produto em `produto` (`201` para criação, `200` para atualização e remoção). IDs inválidos retornam `400`; produtos ausentes, `404`; tentativas sem permissão, `401` ou `403`.

## Postman

Importe [`postman/QUÉX API.postman_collection.json`](./postman/QUÉX%20API.postman_collection.json). Defina a variável de coleção `base_url` para a URL local ou Render. A coleção inclui cadastro, login, `/api/auth/me` e operações de produto; o login guarda o token para as chamadas protegidas.

## Scripts

- `npm start`: inicia a API Express.
- `npm run dev`: inicia a API com reinício automático.
- `npm run dev:front`: inicia o front-end Vite.
- `npm run build`: gera o build de produção do front-end.
- `npm run check`: verifica a sintaxe dos principais arquivos React.
