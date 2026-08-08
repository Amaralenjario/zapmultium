# API Pública ZapMultium — Vendedores & Vendas

Base URL: `https://zapmultium.vercel.app/api/public/v1`

## Autenticação

Toda requisição precisa de uma chave de API. Você pode enviar de 3 formas (qualquer uma):

```bash
# 1) Header Authorization (recomendado)
curl -H "Authorization: Bearer SUA_CHAVE" \
  "https://zapmultium.vercel.app/api/public/v1/sellers?period=mes"

# 2) Header x-api-key
curl -H "x-api-key: SUA_CHAVE" "...".

# 3) Query string (útil pra teste rápido / TV)
curl "https://zapmultium.vercel.app/api/public/v1/sellers?period=mes&api_key=SUA_CHAVE"
```

Sem chave válida → `401`.

## Janela de tempo (parâmetro `period`)

A maioria dos endpoints aceita `period`, ou um intervalo custom `start`/`end` (datas `YYYY-MM-DD`, no fuso de São Paulo):

| valor | significado |
|-------|-------------|
| `hoje` | dia atual |
| `ontem` | dia anterior |
| `7d` | últimos 7 dias |
| `30d` | últimos 30 dias |
| `mes` | mês atual (dia 1 até hoje) |
| `geral` | tudo (desde 2000) |
| `start=YYYY-MM-DD&end=YYYY-MM-DD` | intervalo custom |

Ex.: `?start=2026-07-01&end=2026-07-31`.

---

## `GET /sellers` — Desempenho por vendedor

Retorna **todos os vendedores cadastrados** (não só os que atenderam no período), cada um com
cadastro completo + vendas + atendimento + conversão. A lista vem da base de vendedores do
sistema de vendas, então nome, operação e UTM são canônicos (sem abreviação).

### Query params
- `period` | `start` + `end` — janela (default `hoje`). Afeta **vendas** e **atendimento**; o cadastro é sempre completo.
- `inativos=1` — inclui também vendedores inativos (default: só ativos).

### Resposta

```json
{
  "periodo": { "tipo": "mes", "inicio": "2026-08-01", "fim": "2026-08-07" },
  "total_vendedores": 11,
  "vendedores": [
    {
      "utm": "LF",
      "codigo": "808140",
      "vendedor": "Luiz Felipe",
      "operacao": "Gustavo",
      "genero": "M",
      "avatar": "https://.../avatars/....jpeg",
      "ativo": true,
      "novas": 648,
      "enviadas": 10041,
      "recebidas": 5459,
      "vendas": 35,
      "faturamento": 8549.6,
      "taxa_conversao_pct": 5
    }
  ]
}
```

### Campos por vendedor

| campo | tipo | descrição |
|-------|------|-----------|
| `utm` | string | **Código UTM** do vendedor (ex.: `LF`, `AO`). É o que aparece no campo `utm` das vendas — use pra cruzar `/sales` com o vendedor. |
| `codigo` | string \| null | Código numérico interno do vendedor (ex.: `808140`). |
| `vendedor` | string | Nome completo e padronizado. |
| `operacao` | string \| null | Operação/expert do vendedor (ex.: `Caio`, `Jessica`, `Gustavo`). |
| `genero` | `"M"` \| `"F"` \| null | Gênero (usado p/ Lobo/Rainha). |
| `avatar` | string(url) \| null | Foto do vendedor. `null` quando o vendedor ainda não tem foto cadastrada (ver nota abaixo). |
| `ativo` | boolean | Se o vendedor está ativo. |
| `novas` | number | Conversas novas atendidas no período. |
| `enviadas` | number | Mensagens enviadas no período. |
| `recebidas` | number | Mensagens recebidas no período. |
| `vendas` | number | Qtd. de vendas aprovadas no período. |
| `faturamento` | number | Faturamento (R$) no período. |
| `taxa_conversao_pct` | number | `vendas / novas * 100`, arredondado. |

**Ordenação:** por `vendas` desc, depois `faturamento` desc, depois nome.

> **Nota sobre `avatar`:** a foto vem do cadastro do vendedor no sistema de vendas; se lá não
> houver foto, caímos na foto do perfil do ZapMultium. Vendedores que ainda não têm foto em
> nenhum dos dois voltam `avatar: null` — basta subir a foto no cadastro do vendedor que ela
> passa a aparecer aqui automaticamente.

> **Nota sobre atendimento (`novas`/`enviadas`/`recebidas`):** é somado pelos canais de WhatsApp
> ligados ao vendedor. Vendedor sem canal vinculado (ou que só recebe vendas por link/UTM, sem
> atender no WhatsApp) vem com esses campos em `0` — mas `vendas`/`faturamento` continuam corretos.

---

## `GET /sales` — Vendas detalhadas (paginado)

Cada venda já vem com o **vendedor resolvido pelo UTM**.

### Query params
- `period` | `start` + `end` — janela (default `hoje`).
- `evento` — `purchase_approved` (default) | `refund` | `chargeback` | `all`.
- `utm` — filtra por um vendedor específico (ex.: `utm=LF`).
- `limit` (default 100, máx 500), `offset` (paginação).

### Resposta

```json
{
  "periodo": { "tipo": "hoje", "inicio": "2026-08-07", "fim": "2026-08-07" },
  "filtro": { "evento": "purchase_approved", "utm": null },
  "total": 11,
  "limit": 100,
  "offset": 0,
  "vendas": [
    {
      "id": 12847,
      "produto": "INSTALADOR ROBÔ PRONTO 2.0",
      "valor": 347,
      "valor_texto": "347",
      "evento": "purchase_approved",
      "data": "2026-08-07",
      "utm": "NR",
      "operacao": "Caio",
      "cliente": "Fulano de Tal",
      "email": "...", "telefone": "...",
      "vendedor": "Nicolas Rios",
      "vendedor_codigo": "899379",
      "operacao_vendedor": "Caio"
    }
  ]
}
```

### Campos adicionados por venda
| campo | descrição |
|-------|-----------|
| `vendedor` | Nome do vendedor dono do `utm` da venda. `null` quando a venda não tem UTM de vendedor. |
| `vendedor_codigo` | Código numérico do vendedor. |
| `operacao_vendedor` | Operação do vendedor (pela tabela de vendedores). |

> **Sobre o `utm` das vendas:** nem toda venda tem UTM de vendedor. Vendas de tráfego/orgânico
> podem vir com `utm` = `organic`, vazio ou um código que não é de vendedor — nesses casos
> `vendedor` = `null` (venda **sem atribuição** a vendedor). Para cruzar venda ↔ vendedor, use o
> `utm` da venda contra o `utm` retornado em `/sellers`. Os campos `vendedor*` acima já fazem
> esse cruzamento pra você.

---

## Como montar o relatório de vendedores

1. `GET /sellers?period=mes` → lista mestra (todos, com `utm`, nome, operação, foto).
2. Agrupe por `operacao` pra ter o total por operação.
3. Se precisar do detalhe de vendas de um vendedor: `GET /sales?period=mes&utm=LF`.
4. Cruzamento venda ↔ vendedor: sempre pelo campo `utm` (não pelo nome).

## Outros endpoints (mesma base/auth)
`/team` (equipe com meta/comissão), `/ranking`, `/operations`, `/sales/summary`,
`/overview`, `/leads`, `/conversations`, `/channels`, `/tags`, `/timeseries`, `/flows`.
