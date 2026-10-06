# QUÉX — Marketplace de Pescados

O **QUÉX** é um marketplace online que conecta pescadores e vendedores de pescados diretamente a compradores. Nesta etapa do projeto integrador, iniciamos uma API em Node.js e Express para disponibilizar produtos do marketplace por meio de endpoints HTTP.

## Integrantes

- Larissa Siegel
- Laura Mello
- Samuel Santos

## Tecnologias utilizadas

- **Node.js:** ambiente que executa JavaScript no servidor.
- **NPM:** gerenciador de pacotes do Node.js.
- **Express:** biblioteca utilizada para criar as rotas da API.
- **React e Vite:** tecnologias já utilizadas no front-end do QUÉX.

## Estrutura da entrega de back-end

```text
QUEX/
├── api/                 # Funções serverless já existentes no projeto
├── server.js            # Servidor Express desta entrega
├── package.json         # Dependências e scripts do projeto
└── README.md            # Documentação do projeto e da API
```

## Como executar a API

### 1. Instale as dependências

No terminal, dentro da pasta principal do repositório, execute:

```bash
npm install
```

Esse comando lê o arquivo `package.json` e instala as dependências do projeto, incluindo o Express.

### 2. Inicie o servidor

```bash
npm start
```

Se tudo estiver correto, o terminal exibirá:

```text
Servidor QUÉX rodando em http://localhost:3000
```

Para encerrar o servidor, pressione `Ctrl + C` no terminal.

## Endpoints da API

| VERBO | ENDPOINT (URL) | AÇÃO EXECUTADA |
| --- | --- | --- |
| GET | `/api/produtos` | Retorna uma lista mockada de pescados cadastrados. |
| GET | `/api/produtos/:id` | Retorna um pescado específico pelo seu identificador. |
| POST | `/api/produtos` | Cadastra um novo pescado na lista mockada. |

### GET `/api/produtos`

Retorna todos os produtos cadastrados na API em formato JSON.

**URL completa para teste local:**

```text
http://localhost:3000/api/produtos
```

**Status code retornado:**

| Status | Significado |
| --- | --- |
| `200 OK` | A lista de produtos foi retornada com sucesso. |

**Exemplo de resposta:**

```json
[
  {
    "id": 1,
    "nome": "Tilápia fresca",
    "preco": 28.9,
    "vendedor": "Pesqueiro Mar Azul",
    "especie": "Tilápia"
  },
  {
    "id": 2,
    "nome": "Robalo inteiro",
    "preco": 54.5,
    "vendedor": "Pescador João da Costa",
    "especie": "Robalo"
  }
]
```

### GET `/api/produtos/:id`

Busca apenas um produto pelo seu identificador.

**Exemplo:**

```text
http://localhost:3000/api/produtos/1
```

| Status | Significado |
| --- | --- |
| `200 OK` | O produto foi encontrado e retornado em JSON. |
| `404 Not Found` | Não existe produto com o id informado. |

### POST `/api/produtos`

Cadastra um novo pescado. A requisição deve ser enviada com o cabeçalho `Content-Type: application/json`.

**URL:**

```text
http://localhost:3000/api/produtos
```

**Corpo da requisição:**

```json
{
  "nome": "Salmão em posta",
  "preco": 69.9,
  "vendedor": "Peixaria do Porto",
  "especie": "Salmão"
}
```

| Status | Significado |
| --- | --- |
| `201 Created` | O produto foi cadastrado com sucesso. |
| `400 Bad Request` | Algum campo obrigatório está ausente ou possui valor inválido. |

**Exemplo de resposta de sucesso:**

```json
{
  "mensagem": "Produto cadastrado com sucesso.",
  "produto": {
    "id": 3,
    "nome": "Salmão em posta",
    "preco": 69.9,
    "vendedor": "Peixaria do Porto",
    "especie": "Salmão"
  }
}
```

## Como testar

Para testar o `GET`, deixe o servidor em execução e abra no navegador:

```text
http://localhost:3000/api/produtos
```

Para testar o `POST`, use o Postman:

1. Selecione o método `POST`.
2. Informe a URL `http://localhost:3000/api/produtos`.
3. Em **Body**, selecione **raw** e depois **JSON**.
4. Cole o exemplo de JSON desta documentação.
5. Clique em **Send** e confira o status `201 Created`.

## Observação

Nesta primeira versão, os produtos ficam armazenados apenas em memória. Portanto, os produtos cadastrados por `POST` deixam de existir quando o servidor é reiniciado. A integração com banco de dados será uma evolução futura do back-end.

## Versionamento

O projeto é versionado no GitHub. Cada integrante realizou commits com a própria conta para registrar sua participação no desenvolvimento do QUÉX.
