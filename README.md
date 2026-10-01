# QUÉX — Mercado Online de Peixe

O **QUÉX** é um marketplace online que conecta pescadores e vendedores de pescados diretamente a compradores, facilitando a oferta de peixes e iguarias frescas e permitindo organizar o processo de venda, carrinho, pedidos e entrega em um único sistema.

A interface mantém a identidade visual do projeto original, com azul profundo, laranja, tipografia Inter + Playfair Display, cartões arredondados e uma experiência simples de marketplace. A arquitetura foi reorganizada para funcionar como uma aplicação React/Vite na Vercel, usando **Vercel Serverless Functions + Supabase PostgreSQL/REST** para o back-end.

## Funcionalidades

### Comprador

- Cadastro com nome, e-mail, senha, CPF e telefone.
- Login e sessão persistente por cookie HTTP-only.
- Pesquisa de peixes e iguarias por nome, espécie, descrição ou vendedor.
- Filtros por espécie, com/sem espinha e água doce/água salgada.
- Visualização detalhada de cada produto.
- Carrinho persistido no banco de dados.
- Alteração de quantidade e remoção de itens.
- Checkout com endereço e forma de pagamento.
- Histórico e acompanhamento de pedidos.
- Atualização do próprio perfil e troca de senha.

### Vendedor

- Cadastro com nome, e-mail, senha, CPF/CNPJ, telefone e nome do estabelecimento ou da pessoa.
- Área de loja própria.
- Cadastro, edição, ativação e desativação de produtos.
- Informações do produto: nome, espécie/tipo da iguaria, descrição, preço, estoque, unidade, foto, espinha e tipo de água.
- Visualização dos pedidos que possuem produtos da loja.
- Atualização do andamento do pedido.
- Geração de código de rastreio no despacho.
- Atualização dos dados do vendedor e configuração de entrega própria.

## Stack

- React 18
- Vite
- React Router DOM
- Tailwind CSS
- Lucide React
- React Hot Toast
- Vercel Serverless Functions
- Supabase PostgreSQL / REST API
- Vercel

## Estrutura do projeto

```text
QUEX/
├── api/
│   ├── _lib/
│   │   ├── auth.js
│   │   ├── db.js
│   │   ├── http.js
│   │   └── password.js
│   ├── auth/
│   │   ├── change-password.js
│   │   ├── login.js
│   │   ├── logout.js
│   │   ├── me.js
│   │   └── register.js
│   ├── cart.js
│   ├── checkout.js
│   ├── orders.js
│   ├── products.js
│   └── profile.js
├── public/
│   └── manifest.json
├── src/
│   ├── api/
│   │   ├── client.js
│   │   └── data.js
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.jsx
│   │   │   └── NavBar.jsx
│   │   ├── products/
│   │   │   └── ProductCard.jsx
│   │   ├── AuthLayout.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── ui.jsx
│   ├── lib/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── seller/
│   │   │   ├── ProductForm.jsx
│   │   │   └── SellerDashboard.jsx
│   │   ├── Cart.jsx
│   │   ├── Checkout.jsx
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── Marketplace.jsx
│   │   ├── NotFound.jsx
│   │   ├── Orders.jsx
│   │   ├── ProductDetail.jsx
│   │   ├── Profile.jsx
│   │   └── Register.jsx
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   ├── schema.sql
│   ├── app.sql
│   └── hardening.sql
├── .env.example
├── .env
├── index.html
├── jsconfig.json
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vercel.json
└── vite.config.js
```

## Banco de dados

O arquivo `supabase/schema.sql` corresponde ao modelo fornecido para o projeto:

- `usuario`
- `comprador`
- `vendedor`
- `produto`
- `carrinho`
- `item_carrinho`
- `pedido`
- `pedido_item`
- `pagamento`
- `entrega`

O campo `produto` usado pelo front inclui exatamente os filtros existentes no schema: `tem_espinha`, `tipo_agua` e `unidade`.

### Importante sobre peixes e iguarias

O schema fornecido não possui uma coluna `categoria`. Por isso, esta versão não inventa uma coluna que não existe no seu banco. O marketplace pesquisa conjuntamente peixes e iguarias através de `nome`, `especie`, `descricao` e vendedor.

## Instalação

```bash
npm install
```

Para desenvolver apenas o front:

```bash
npm run dev
```

Para executar o projeto completo com as Serverless Functions da Vercel localmente, use a CLI da Vercel:

```bash
npm run dev:vercel
```

## Configuração do Supabase

O banco usado por esta versão é o banco descrito em `supabase/schema.sql`.

Como o banco já foi criado, **não recrie as tabelas** caso elas já existam.

Execute apenas uma vez o arquivo:

```text
supabase/app.sql
```

Ele cria a função transacional usada pelo checkout:

```text
quex_finalizar_checkout
```

O arquivo `supabase/hardening.sql` é opcional e adiciona RLS e índices. Ele é recomendado quando o sistema estiver exposto publicamente.

## Variáveis de ambiente

O back-end da Vercel precisa destas variáveis:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
JWT_SECRET=uma_chave_aleatoria_com_pelo_menos_32_caracteres
VITE_APP_NAME=QUÉX
```

### Segurança

A `SUPABASE_SERVICE_ROLE_KEY` **nunca deve chegar ao navegador**. Ela só é usada pelas funções da pasta `api/`.

O arquivo `.env` deste repositório é apenas um **template** e não possui credenciais reais. Não substitua esse conteúdo por uma service role key e faça commit dela no GitHub.

Na Vercel, configure as variáveis em:

`Project Settings → Environment Variables`

Depois de alterar variáveis, faça um novo deploy para que o valor seja aplicado.

## Autenticação

Esta versão **não usa `auth.users` nem Supabase Auth** para representar compradores e vendedores. A autenticação foi adaptada para o schema fornecido, no qual `usuario.id` é `SERIAL` e `comprador`/`vendedor` usam esse mesmo ID.

As sessões são representadas por um JWT assinado no servidor e armazenado em cookie `HttpOnly`.

As senhas novas são armazenadas na coluna `usuario.senha` em formato derivado por `scrypt`. Para compatibilidade, contas antigas que tenham senha em texto simples ainda podem fazer login; depois do primeiro login a senha é migrada para o formato protegido.

## Fluxo do cadastro

### Comprador

```text
usuario
  id
  nome
  email
  senha
  telefone
  tipo = comprador
      │
      └── comprador
          id = usuario.id
          cpf
```

### Vendedor

```text
usuario
  id
  nome
  email
  senha
  telefone
  tipo = vendedor
      │
      └── vendedor
          id = usuario.id
          comercial
          cpf_cnpj
          localizacao
          entrega_propria
```

## Checkout

O checkout foi desenhado respeitando o schema atual. Como `entrega.pedido_id` é único e cada entrega possui um único `vendedor_id`, o QUÉX exige que um pedido contenha produtos de **um único vendedor**.

Durante a finalização, a função SQL:

1. bloqueia o carrinho;
2. valida estoque e disponibilidade;
3. calcula o valor total;
4. cria o `pedido`;
5. cria os `pedido_item`;
6. cria o `pagamento` como pendente;
7. cria a `entrega`;
8. baixa o estoque;
9. limpa os itens do carrinho.

Tudo isso acontece dentro de uma única transação PostgreSQL.

## Pagamentos

O schema possui a tabela `pagamento`, mas não existe gateway de pagamento integrado. O QUÉX registra a forma escolhida (`pix`, `cartao` ou `dinheiro`) como `pendente`.

Para cobrança real, seria necessário integrar um provedor de pagamentos separado.

## Deploy na Vercel

1. Faça push deste projeto para o GitHub.
2. Importe o repositório na Vercel.
3. Deixe o framework como Vite ou configure o build como `npm run build`.
4. Defina as variáveis `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `JWT_SECRET` em **Environment Variables**.
5. Faça o deploy.

O `vercel.json` já mantém o fallback para o React Router e define o diretório `dist` como saída do build.

## Observação sobre `.env` na Vercel

O arquivo `.env` está incluído neste pacote somente como modelo porque você pediu que ele existisse no repositório. **Não use o GitHub como mecanismo para armazenar a service role key.** A Vercel recomenda configurar segredos nas variáveis de ambiente do próprio projeto; o `.env` local pode ser obtido depois com `vercel env pull`.

## Status

O projeto está preparado para a arquitetura:

```text
GitHub
   ↓
Vercel
   ├── React/Vite
   └── Serverless API
          ↓
      Supabase REST
          ↓
     PostgreSQL
```
