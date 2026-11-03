# Kivo — Modelo de dados em MongoDB

Repositório acadêmico com:

1. a **descrição do sistema Kivo**;
2. o **código que cria o banco, as coleções e documentos de exemplo** no MongoDB online (MongoDB Atlas).

---

## 1. Descrição do sistema

O **Kivo** é um **SaaS** (software vendido por assinatura) que coloca um **Agente de Inteligência Artificial no WhatsApp** de **corretoras de seguros**.

### O problema
Corretoras recebem todos os dias as mesmas perguntas dos clientes no WhatsApp: *"me manda a 2ª via do boleto"*, *"qual a situação do meu sinistro?"*, *"preciso de guincho"*. Responder isso manualmente toma o tempo da equipe e o cliente fica esperando, principalmente fora do horário comercial.

### A solução
Cada corretora:

1. **se cadastra** no Kivo (dados da empresa, endereço, contato e os segmentos em que atua: auto, vida, saúde, residencial, empresarial…);
2. **escolhe um plano** (Starter, Pro ou Business), que inclui uma franquia mensal de uso da IA e de mensagens;
3. **conecta as seguradoras** com que trabalha (Porto Seguro, Allianz, Tokio Marine…), para a IA consultar boletos, apólices e sinistros direto na fonte;
4. **cadastra a equipe** (dono, administradores e atendentes) que acompanha os atendimentos pelo painel;
5. deixa a **IA atender os clientes 24h** no pós-venda. Quando precisa, a conversa passa para um atendente humano.

### Como o Kivo cobra
- **Mensalidade do plano**, com uma **franquia** de tokens de IA e de mensagens.
- **Carteira pré-paga**: o que passa da franquia (**excedente**) é descontado do saldo da carteira. A corretora recarrega a carteira por Pix, boleto ou cartão. A carteira pode ficar negativa até um **limite de negativado**.
- Preços de consumo:
  - **IA**: preço por **1 milhão de tokens** (`preço = tokens ÷ 1.000.000 × preço unitário`);
  - **Mensagens**: preço por **mensagem enviada** e por **mensagem recebida**.

### Multi-empresa (multi-tenant)
Muitas corretoras usam o mesmo sistema, mas uma nunca vê os dados da outra. Por isso **todo documento de negócio carrega o `brokerageId`** (a corretora dona dele), e as buscas sempre filtram por ele.

### Por que MongoDB
- Dados com **formato flexível**: o endereço e o contato ficam **dentro** do documento da corretora, sem precisar de tabelas extras.
- O **consumo** (`usage`) é um volume grande de registros pequenos, gravados o tempo todo, e somados por mês com o *aggregation pipeline*.
- Mesmo sendo flexível, o banco **valida** os documentos com `$jsonSchema`, para não aceitar dado errado.

---

## 2. O banco de dados

Banco: **`kivo`** — 9 coleções (nomes em inglês):

| Coleção | O que guarda |
|---|---|
| `brokerages` | **Corretoras**: cadastro (razão social, nome fantasia, CNPJ), segmentos, endereço e contato |
| `plans` | **Plano de cada corretora**: qual plano assinou, preço, franquias e histórico (só 1 ativo por vez) |
| `users` | **Usuários do painel**: dono, admin e atendentes, e em quais corretoras trabalham |
| `insurers` | **Seguradoras conectadas** por cada corretora e o status da conexão |
| `customers` | **Clientes finais** que falam com a corretora pelo WhatsApp |
| `labels` | **Rótulos** para organizar os clientes (ex.: Urgent, Renewal, VIP) |
| `usage` | **Consumo de tudo**: tokens de IA, mensagens enviadas e recebidas — com o `type` para diferenciar, o preço de cada e o excedente |
| `wallet` | **Carteira** de cada corretora: saldo e limite de negativado |
| `invoices` | **Todas as faturas**: mensalidades dos planos e recargas da carteira |

---

## 3. Estrutura do repositório

```
kivo-mongodb/
├── README.md                # este arquivo
├── src/
│   ├── config.js            # lê a connection string do arquivo .env
│   ├── collections.js       # as 9 coleções: regras de validação ($jsonSchema) e índices
│   ├── seed-data.js         # documentos de exemplo (2 corretoras fictícias)
│   ├── setup.js             # cria o banco, as coleções, os índices e insere os exemplos
│   └── queries.js           # consultas de exemplo (consumo do mês, carteiras, faturas…)
└── package.json
```

---

## 4. Como rodar

### 4.1 Pré-requisitos
- [Node.js](https://nodejs.org) 22.9 ou mais novo
- Uma conta gratuita no [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)

### 4.2 Criar o banco online (MongoDB Atlas)
1. Entre no Atlas e clique em **Create** → escolha o cluster gratuito **M0 (Free)** → região **São Paulo (sa-east-1)** → **Create Deployment**.
2. Na tela que abre, crie o **usuário do banco** (usuário e senha — guarde a senha).
3. Em **Network Access**, adicione o seu IP (**Add Current IP Address**).
4. Em **Database → Connect → Drivers**, copie a **connection string** (`mongodb+srv://...`) e troque `<db_password>` pela senha do passo 2.

### 4.3 Configurar e executar
```bash
git clone https://github.com/DavidFreitasCosta/kivo-mongodb.git
cd kivo-mongodb
npm install
# crie um arquivo .env com a linha MONGODB_URI=<sua connection string>/kivo
npm run setup             # cria o banco "kivo", as 9 coleções, os índices e os exemplos
npm run queries           # mostra consultas de exemplo no terminal
```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run setup:reset` | Apaga as 9 coleções e cria tudo de novo |

Depois do `npm run setup`, os dados aparecem no Atlas em **Database → Browse Collections → kivo**.

> Todos os dados de exemplo (empresas, CNPJs, CPFs, telefones, e-mails) são **fictícios**.
