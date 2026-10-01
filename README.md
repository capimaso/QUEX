# QUÉX — Marketplace de Pescados

QUÉX é um marketplace online que conecta diretamente pescadores artesanais a compradores, reduzindo intermediários e tornando peixes e iguarias frescas mais acessíveis ao público.

O projeto mantém a ideia visual do marketplace original, mas reorganiza a arquitetura para uma implantação simples na Vercel usando **React + Vite no front-end e Supabase Auth + PostgreSQL no back-end**. A camada antiga do Base44 foi removida do fluxo principal.

## O que foi adaptado

- Front-end React/Vite mantido com a identidade visual original: azul profundo, laranja, tipografia Inter + Playfair Display, cards arredondados e layout de marketplace.
- Autenticação de compradores e vendedores feita pelo Supabase Auth.
- Cadastro de vendedor com **nome, senha, e-mail, CPF/CNPJ, telefone e nome do estabelecimento (ou nome da pessoa)**.
- Cadastro de comprador com **nome, senha, e-mail, CPF e telefone**.
- Barra de pesquisa para **peixes e iguarias**, incluindo nome, espécie, descrição, categoria e vendedor.
- Página individual do produto com **descrição, valor, quantidade em estoque, categoria, espinha e tipo de água**.
- Filtros do marketplace para **peixe/iguaria, espécie, com/sem espinha, água doce/água salgada e ordenação por preço**.
- Área do vendedor com criação, edição, ativação/desativação e exclusão de anúncios.
- Carrinho persistido no PostgreSQL.
- Checkout com endereço de entrega.
- Pedido criado de forma transacional no banco, com baixa de estoque.
- Área de pedidos do comprador.
- Painel de pedidos do vendedor com avanço de status.
- Row Level Security (RLS) no Supabase para separar dados de compradores e vendedores.
- `vercel.json` preparado para rotas do React Router em SPA.

## Tecnologias

- React 18
- Vite
- React Router
- Tailwind CSS
- Lucide React
- Supabase Auth
- Supabase PostgreSQL / REST API
- Vercel

## Estrutura

```text
QUEX-seafood_marketplace/
├── public/
│   └── manifest.json
├── src/
│   ├── api/
│   │   └── data.js
│   ├── components/
│   │   ├── layout/
│   │   ├── products/
│   │   ├── AuthLayout.jsx
│   │   ├── ProtectedRoute.jsx
│   │   └── ui.jsx
│   ├── lib/
│   │   ├── AuthContext.jsx
│   │   └── supabaseRest.js
│   ├── pages/
│   │   ├── seller/
│   │   └── ...
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── supabase/
│   └── schema.sql
├── .env.example
├── package.json
├── tailwind.config.js
├── vite.config.js
└── vercel.json
```

## Configuração local

### 1. Instale as dependências

```bash
npm install
```

### 2. Crie o projeto no Supabase

Crie um projeto no Supabase e copie os valores do projeto para um arquivo `.env.local`:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

### 3. Prepare o banco

No **SQL Editor** do Supabase, execute o conteúdo de:

```text
supabase/schema.sql
```

Esse arquivo cria/atualiza as tabelas usadas pelo QUÉX, ativa RLS, cria o trigger de perfil e disponibiliza a função transacional de checkout.

### 4. Configuração de e-mail do Supabase

O cadastro usa e-mail + senha. Dependendo da configuração de autenticação do projeto, o Supabase pode exigir confirmação do endereço antes de liberar a sessão. Nesse caso, o próprio QUÉX informa o usuário para conferir o e-mail.

Para uma demonstração acadêmica em que o login deve funcionar imediatamente após o cadastro, a confirmação obrigatória de e-mail pode ser desativada nas configurações de autenticação do projeto Supabase.

### 5. Execute

```bash
npm run dev
```

Acesse o endereço exibido pelo Vite, normalmente:

```text
http://localhost:5173
```

## Deploy na Vercel

1. Faça push deste projeto para um novo repositório no GitHub.
2. Na Vercel, importe o repositório.
3. O projeto é detectado como Vite e usa `npm run build`.
4. Em **Settings → Environment Variables**, adicione em **Production, Preview e Development**:

```text
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
```

5. No Supabase, em **Authentication → URL Configuration**, inclua a URL pública da Vercel na lista de URLs permitidas para redirecionamento, além da URL local usada no desenvolvimento. Isso é necessário para o fluxo de recuperação de senha.

6. Faça um novo deploy.

Não é necessário criar um servidor Node separado. A Vercel publica o front-end React e o Supabase fornece autenticação, banco e Data API.

## Banco de dados

As principais entidades são:

| Tabela | Função |
|---|---|
| `profiles` | Dados públicos/funcionais da conta, incluindo papel de comprador ou vendedor. |
| `produto` | Anúncios de peixes e iguarias. |
| `cart_items` | Carrinho persistido de cada comprador. |
| `orders` | Cabeçalho dos pedidos. |
| `order_items` | Itens e vendedor de cada pedido. |

O produto preserva a nomenclatura compatível com a integração Supabase já presente no projeto original, incluindo os campos `tem_espinha` e `tipo_agua`.

## Regras de negócio do produto

### Comprador

- Pode pesquisar peixes e iguarias.
- Pode abrir a página detalhada do produto.
- Pode filtrar por espécie, categoria, espinha e tipo de água.
- Pode adicionar itens ao carrinho.
- Pode finalizar pedidos.
- Pode acompanhar seus próprios pedidos.
- Pode editar o próprio perfil.

### Vendedor

- Pode criar anúncios.
- Pode editar os próprios anúncios.
- Pode ativar ou desativar produtos.
- Pode excluir os próprios anúncios.
- Pode definir preço, estoque, categoria, espécie, descrição, unidade, foto, espinha e tipo de água.
- Pode visualizar pedidos que contenham seus produtos.
- Pode avançar o status operacional do pedido.

## Segurança

O front-end utiliza somente a chave pública/anon do Supabase. As regras de acesso são aplicadas no PostgreSQL por meio de **Row Level Security**. Nenhum segredo de servidor ou service key deve ser colocado em variáveis `VITE_*`.

## Rotas principais

```text
/login
/register
/forgot-password
/reset-password
/
/marketplace
/product/:id
/cart
/checkout
/orders
/profile
/seller/dashboard
/seller/product/new
/seller/product/:id
```

## Verificação rápida

Depois de instalar as dependências, rode:

```bash
npm run check
npm run build
```

`npm run check` faz uma checagem sintática dos arquivos-fonte. `npm run build` é a mesma etapa de compilação usada no deploy do front-end.

## Origem do projeto

Este repositório é uma adaptação do projeto **QUEX-seafood_marketplace**, originalmente organizado como um app Base44 com React/Vite e uma integração Supabase REST já presente em partes do fluxo de produtos.

A proposta desta versão é concentrar o funcionamento em uma única aplicação React implantável na Vercel, usando o Supabase como camada persistente de autenticação e dados, sem alterar a identidade visual principal do projeto.
