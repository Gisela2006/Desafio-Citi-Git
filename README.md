# 🌿 Folhagem & Cia — API da loja de plantas

API REST que substitui a planilha da loja **Folhagem & Cia**: cadastro de plantas,
controle de estoque, venda com baixa de estoque e valor total do estoque.

O projeto nasceu do CRUD de usuários do treinamento do CITi (`UserController` /
`UserRepository`) e segue exatamente a mesma organização em camadas — a diferença é
que a `Planta` tem regras de negócio de verdade (validação, enum, estoque, venda).

**Stack:** Node.js · Express · TypeScript · Prisma · PostgreSQL · Docker

| Arquivo | O que tem |
|---|---|
| `README.md` (este) | O que a API faz, como rodar, modelo de dados, rotas, erros e decisões |
| [`RELATORIO.md`](RELATORIO.md) | O relatório do desafio (o que foi feito, como, dificuldades e uso de IA) |
| [`DESAFIO.md`](DESAFIO.md) | O enunciado original |
| `scripts/smoke-test.ps1` | Roda a bateria de testes da seção 4 do enunciado e confere os status |

---

## ✅ Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — roda a API e o banco em containers. **Deixe aberto** sempre que for rodar o projeto.
- [Node.js 20+](https://nodejs.org) — só para rodar os comandos (`npm`/`yarn`) na sua máquina.
- Um cliente HTTP: [Thunder Client](https://www.thunderclient.com/), Insomnia ou Postman. (Ou o `scripts/smoke-test.ps1`.)

---

## ⚙️ Como rodar do zero

Com o Docker Desktop aberto, na raiz do projeto:

```powershell
# 1. Crie o .env a partir do modelo (não vai para o git)
copy .env.example .env

# 2. Instale as dependências na sua máquina
npm install          # ou: yarn

# 3. Suba a API e o banco
docker compose up -d --build

# 4. Aplique as migrations (cria as tabelas User e Planta)
npm run migration    # ou: yarn migration

# 5. (opcional) Popule o banco com plantas de exemplo
npm run seed         # ou: yarn seed
```

Confira em `http://localhost:3001`:

```json
{ "message": "API do treinamento de CRUD do CITi 🚀" }
```

> A migration da `Planta` já está commitada em
> `prisma/migrations/20261027120000_create_planta_model/`, então o passo 4 cria a
> tabela sem precisar gerar nada novo.

### O `.env`

O `.env` guarda as configurações do projeto e **não vai para o git**. Os valores do
`.env.example` já funcionam; só mexa em:

| Variável | Quando mexer |
|---|---|
| `SERVER_PORT` | A porta 3001 já está em uso |
| `DATABASE_PORT` | A porta 5432 já está em uso (por exemplo, por um Postgres instalado na máquina) |

> **Por que o host do banco é `treinamento-crud-db` e não `localhost`?** A API roda
> *dentro* do Docker e enxerga o banco pelo nome do container. Os comandos que rodam
> na sua máquina (`migration`, `studio`, `seed`) trocam o host para `localhost` sozinhos.

### Comandos do dia a dia

| Comando | O que faz |
|---|---|
| `docker compose up -d` | Sobe a API e o banco |
| `docker compose logs -f server` | Mostra os logs da API (é aqui que os erros aparecem) |
| `docker compose down` | Derruba os containers (os dados do banco continuam salvos) |
| `npm run migration` | Aplica as migrations pendentes no banco |
| `npm run seed` | Limpa a tabela `Planta` e insere 5 plantas de exemplo |
| `npm run studio` | Abre o Prisma Studio para ver o banco no navegador |
| `npm run typecheck` | Procura erros de tipo no TypeScript |
| `powershell -ExecutionPolicy Bypass -File scripts/smoke-test.ps1` | Roda os testes automáticos (precisa da API no ar) |

A API recarrega sozinha quando você salva um arquivo em `src/`. Só rode
`docker compose up -d --build` de novo se mudar o `package.json` ou o `Dockerfile`.

---

## 🗃️ Modelo de dados

### `Planta`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | `Int` autoincrement | Gerado pelo banco |
| `nome` | `String` | Nome popular. Obrigatório, não pode ser vazio |
| `especie` | `String` | Nome científico. Obrigatório, não pode ser vazio |
| `preco` | `Int` | **Em centavos**. Inteiro **maior que zero** (`8990` = R$ 89,90) |
| `estoque` | `Int` | Inteiro **maior ou igual a zero** (zero = esgotada) |
| `luminosidade` | `Luminosidade` (enum) | `SOMBRA`, `MEIA_SOMBRA` ou `SOL_PLENO` |
| `petFriendly` | `Boolean` | Segura para cães e gatos? |
| `regaACadaDias` | `Int` | Inteiro **maior ou igual a 1** |
| `createdAt` / `updatedAt` | `DateTime` | Preenchidos pelo banco |

```prisma
model Planta {
  id            Int          @id @default(autoincrement())
  nome          String
  especie       String
  preco         Int
  estoque       Int
  luminosidade  Luminosidade
  petFriendly   Boolean
  regaACadaDias Int
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
}

enum Luminosidade {
  SOMBRA
  MEIA_SOMBRA
  SOL_PLENO
}
```

> **Por que centavos?** Decimais de ponto flutuante têm erro de arredondamento
> (`0.1 + 0.2 = 0.30000000000000004`). Com inteiros, toda conta com dinheiro é exata.

---

## 🔌 Rotas

Todas as rotas de planta ficam em `/plantas`. O corpo e as respostas são JSON.

| # | Método | Rota | O que faz | Sucesso |
|---|---|---|---|---|
| 1 | `POST` | `/plantas` | Cadastra uma planta | `201` |
| 2 | `GET` | `/plantas` | Lista as plantas, com filtros opcionais | `200` |
| 3 | `GET` | `/plantas/:id` | Busca uma planta pelo id | `200` |
| 4 | `PATCH` | `/plantas/:id` | Edita só os campos enviados | `200` |
| 5 | `DELETE` | `/plantas/:id` | Remove uma planta | `204` |
| 6 | `POST` | `/plantas/:id/venda` | Baixa `quantidade` vasos do estoque | `200` |
| 7 | `GET` | `/plantas/estoque/valor-total` | Soma `preco × estoque` e o total de vasos | `200` |
| 8 | `GET` | `/plantas/esgotadas` | Lista as plantas com estoque zero (bônus) | `200` |

> A ordem de registro em `src/routes.ts` importa: as rotas fixas
> (`/plantas/estoque/valor-total` e `/plantas/esgotadas`) vêm **antes** de
> `/plantas/:id`, senão `"esgotadas"` seria interpretado como um id.

### 1. `POST /plantas`

Todos os campos são obrigatórios.

```json
{
  "nome": "Costela-de-adão",
  "especie": "Monstera deliciosa",
  "preco": 8990,
  "estoque": 12,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": false,
  "regaACadaDias": 3
}
```

`201 Created`:

```json
{
  "id": 1,
  "nome": "Costela-de-adão",
  "especie": "Monstera deliciosa",
  "preco": 8990,
  "estoque": 12,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": false,
  "regaACadaDias": 3,
  "createdAt": "2026-10-31T21:00:00.000Z",
  "updatedAt": "2026-10-31T21:00:00.000Z"
}
```

`400` se faltar campo ou se algum valor quebrar uma regra:

```json
{ "message": "Campos obrigatórios não enviados: especie, preco." }
{ "message": "O campo preco deve ser um número inteiro maior que zero (o valor em centavos, por exemplo 8990)." }
{ "message": "O campo estoque deve ser um número inteiro maior ou igual a zero." }
{ "message": "O campo luminosidade deve ser um dos valores: SOMBRA, MEIA_SOMBRA, SOL_PLENO." }
{ "message": "O campo petFriendly deve ser true ou false." }
{ "message": "O campo regaACadaDias deve ser um número inteiro maior ou igual a 1." }
```

> `"preco": "8990"` (texto) é `400`: o campo é `Int` no banco e a API só aceita número.

### 2. `GET /plantas`

Sem filtro, devolve todas as plantas. Filtros opcionais, sozinhos ou combinados:

| Query | Valores | Exemplo |
|---|---|---|
| `luminosidade` | `SOMBRA` · `MEIA_SOMBRA` · `SOL_PLENO` | `?luminosidade=SOL_PLENO` |
| `petFriendly` | `true` · `false` | `?petFriendly=true` |
| `nome` (bônus) | texto, sem diferenciar maiúsculas | `?nome=costela` |
| `ordem` (bônus) | `preco` · `nome` | `?ordem=preco` |

```
GET /plantas?luminosidade=SOL_PLENO&petFriendly=true
GET /plantas?nome=costela
GET /plantas?ordem=preco
```

`200` com a lista (vazia, `[]`, se nada combinar — filtro válido sem resultado **não** é 404).
`400` se o filtro tiver valor inválido (`?luminosidade=LUA`, `?petFriendly=sim`, `?ordem=cor`).

### 3. `GET /plantas/:id`

`200` com a planta. `404` se o id não existir. `400` se o id não for um inteiro positivo (`/plantas/abc`).

### 4. `PATCH /plantas/:id`

Envie **só** o que vai mudar; o resto continua igual. Os campos enviados passam pelas
mesmas regras do cadastro.

```json
{ "preco": 9490 }
```

`200` com a planta atualizada · `400` valor inválido ou corpo sem nenhum campo conhecido ·
`404` id inexistente.

### 5. `DELETE /plantas/:id`

`204 No Content` (sem corpo). `404` se o id não existir — inclusive na segunda vez.

### 6. `POST /plantas/:id/venda`

```json
{ "quantidade": 2 }
```

`200` com a planta já com o estoque descontado:

```json
{ "id": 1, "nome": "Costela-de-adão", "estoque": 10, "...": "..." }
```

- `400` se `quantidade` não for inteiro maior que zero (`0`, `-1`, `1.5`, `"2"`).
- `400` se não houver estoque suficiente — **e nada é alterado**:
  `{ "message": "Estoque insuficiente: temos só 1 vaso(s) de Costela-de-adão." }`
- `404` se o id não existir.

> A baixa é feita com um `UPDATE ... WHERE id = ? AND estoque >= quantidade`
> (`updateMany` + `decrement`), resolvido em uma única instrução pelo banco. Duas
> compras simultâneas do último vaso não conseguem passar as duas.

### 7. `GET /plantas/estoque/valor-total`

```json
{ "valorTotalEmCentavos": 203030, "totalDeVasos": 37 }
```

`200` sempre — loja vazia responde `{ "valorTotalEmCentavos": 0, "totalDeVasos": 0 }`.
Com o `seed` rodado, a conta é:

| Planta | preço × estoque |
|---|---|
| Costela-de-adão | 8990 × 12 = 107880 |
| Samambaia | 4590 × 8 = 36720 |
| Cacto-bola | 2990 × 15 = 44850 |
| Zamioculca | 6790 × 2 = 13580 |
| Espada-de-são-jorge | 5490 × 0 = 0 |
| **Total** | **203030 centavos** e **37 vasos** |

### 8. `GET /plantas/esgotadas` (bônus)

`200` com as plantas de `estoque: 0`, em ordem alfabética.

---

## ⚠️ Erros e status HTTP

| Status | Quando |
|---|---|
| `400` | Corpo não é JSON válido, campo obrigatório faltando, valor fora da regra (`preco` ≤ 0, `estoque` negativo, `luminosidade` fora do enum, `petFriendly` não booleano, `regaACadaDias` < 1), `:id` não numérico, filtro inválido, `quantidade` inválida ou estoque insuficiente |
| `404` | `:id` não existe (GET, PATCH, DELETE, venda) ou rota inexistente |
| `500` | Erro inesperado (banco fora do ar, por exemplo) — sempre com `{ "message": ... }` |

Toda resposta de erro tem o formato `{ "message": "texto explicando o problema" }`.

---

## 🧠 Decisões de projeto

1. **Uma única função de validação** (`validarDadosDaPlanta`) serve `POST` e `PATCH`:
   `exigirTodos: true` no cadastro (falta campo → 400), `false` na edição (só valida o que veio).
2. **Nunca `if (!campo)`**: `!0` e `!false` são `true`. Campo ausente é checado com
   `valor === undefined`; o conteúdo, com `typeof`/`Number.isInteger`/`Object.values(Luminosidade).includes`.
3. **Textos são gravados com `trim()`**, e `"   "` é recusado como nome/especie vazio.
4. **`PATCH` com corpo vazio** (`{}` ou só campos desconhecidos) responde `400` em vez de
   fingir que editou algo.
5. **Venda atômica**: `updateMany` com `estoque: { gte: quantidade }`. Se o `count` volta 0,
   a API relê a planta: se ainda existe, é `400` de estoque insuficiente; se sumiu no meio, `404`.
6. **Valor total no código**: o `aggregate` do Prisma soma uma coluna, não `preco × estoque`,
   então buscamos só as duas colunas (`select`) e somamos com `reduce`.
7. **Filtros**: `?petFriendly=true` chega como a string `"true"`, convertida com `=== "true"`.
   Filtro ausente (`undefined`) não entra no `where`; filtro inválido é `400`.
8. **`seed` é destrutivo** (limpa `Planta` antes de inserir) para poder rodar várias vezes
   e sempre deixar o banco no mesmo estado — não use em produção.
9. **Bônus implementados**: busca por nome sem diferenciar maiúsculas, ordenação
   (`?ordem=preco|nome`, ascendente) e `GET /plantas/esgotadas`. O bônus de `seed` também.

---

## 🧪 Testes

### Automático

Com a API no ar (`docker compose up -d`), em outro terminal:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```

O script percorre a tabela de testes da seção 4 do enunciado (cadastro válido e inválido,
404, filtros, venda, valor total, delete) e imprime `PASS`/`FAIL` com o status esperado.
Ele cria as próprias plantas e apaga no fim.

### Manual (Thunder Client / Insomnia)

1. `POST http://localhost:3001/plantas`, **Body → JSON**, com o JSON do exemplo 1.
2. `GET http://localhost:3001/plantas`, `/plantas/1`, `/plantas?petFriendly=true`.
3. `PATCH /plantas/1` com `{ "estoque": 5 }`.
4. `POST /plantas/1/venda` com `{ "quantidade": 2 }` e depois com `{ "quantidade": 999 }`.
5. `GET /plantas/estoque/valor-total`.
6. `DELETE /plantas/1` → `204`, depois `GET /plantas/1` → `404`.

---

## 📁 Estrutura

```
prisma/
  schema.prisma                     # models User e Planta + enums
  migrations/                       # histórico do banco (commitado)
  seed.ts                           # plantas de exemplo (bônus)
src/
  server.ts                         # cria o app Express e sobe o servidor
  routes.ts                         # liga cada rota HTTP a uma função do controller
  database/index.ts                 # conexão com o banco (Prisma Client)
  controllers/UserController.ts     # CRUD de usuários (o modelo)
  controllers/PlantaController.ts   # validação + regras de negócio + status HTTP
  repositories/UserRepository.ts    # consultas de usuário
  repositories/PlantaRepository.ts  # consultas de planta (única camada que fala com o Prisma)
scripts/
  smoke-test.ps1                    # testes de fumaça das rotas
```

O caminho de uma requisição:

```
Requisição → routes.ts → Controller → Repository → Banco
                              ↓
Resposta  ←───────────────────┘  (status HTTP + JSON)
```

---

## 🆘 Problemas comuns

| Erro | O que fazer |
|---|---|
| `'cross-env' não é reconhecido como um comando` | Faltou instalar as dependências na sua máquina: rode `npm install`. |
| `Environment variable not found: DATABASE_URL` | Falta o `.env` na raiz do projeto: `copy .env.example .env`. |
| `failed to connect to the docker API` | O Docker Desktop está fechado. Abra e espere ele ficar pronto. |
| `port is already allocated` | Troque `SERVER_PORT` ou `DATABASE_PORT` no `.env` e suba de novo. |
| `Can't reach database server` | Os containers não estão de pé: `docker compose up -d`. |
| `Property 'planta' does not exist on type 'PrismaClient'` | Rode `npm run migration` e, no VS Code, **Ctrl+Shift+P → Restart TS Server**. |
| A API não responde em `localhost:3001` | Veja o erro em `docker compose logs -f server`. |
| `500` ao criar ou editar depois de mudar o `schema.prisma` | O banco ainda está com as colunas antigas: rode `npm run migration`. |
| `SyntaxError: ... is not valid JSON` ou `req.body` chega `undefined` | O corpo não foi como JSON. Cole o JSON puro em **Body → JSON**. |

> Dica: rode `npm run typecheck` antes de testar. A API não mostra erros de tipo ao
> rodar, mas o `typecheck` mostra todos de uma vez.
