// Definição das 9 coleções do banco "kivo".
// Cada coleção tem:
//   - validator: regras ($jsonSchema) que o MongoDB confere antes de aceitar um documento;
//   - indexes: índices para buscas rápidas e para garantir valores únicos.

// ---------- Pequenos atalhos para escrever os schemas ----------
const objectId = { bsonType: "objectId" };
const string = { bsonType: "string", minLength: 1 };
const date = { bsonType: "date" };
const dateOrNull = { bsonType: ["date", "null"] };
const money = { bsonType: "decimal" }; // Decimal128: dinheiro sem erro de arredondamento
const count = { bsonType: "int", minimum: 0 };
const oneOf = (...values) => ({ bsonType: "string", enum: values });
const pattern = (regex) => ({ bsonType: "string", pattern: regex });

const E164_PHONE = "^\\+[1-9][0-9]{7,14}$"; // ex.: +5534999990000
const EMAIL = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";

// Subdocumento (fica dentro de outro documento, sem _id próprio)
function subdocument(required, properties) {
  return { bsonType: "object", required, properties, additionalProperties: false };
}

// Documento principal da coleção (inclui o _id)
function document(required, properties) {
  return {
    $jsonSchema: {
      bsonType: "object",
      required,
      properties: { _id: objectId, ...properties },
      additionalProperties: false,
    },
  };
}

// ---------- As coleções ----------
export const collections = [
  {
    // Corretoras: dados de cadastro e segmento
    name: "brokerages",
    validator: document(
      ["legalName", "tradeName", "taxId", "segments", "address", "contact", "status", "createdAt"],
      {
        legalName: string,
        tradeName: string,
        taxId: pattern("^[0-9]{14}$"), // CNPJ só com números
        segments: {
          bsonType: "array",
          minItems: 1,
          uniqueItems: true,
          items: oneOf("auto", "life", "health", "home", "business", "travel"),
        },
        address: subdocument(["street", "number", "district", "city", "state", "zipCode"], {
          street: string,
          number: string,
          complement: string,
          district: string,
          city: string,
          state: pattern("^[A-Z]{2}$"),
          zipCode: pattern("^[0-9]{8}$"),
        }),
        contact: subdocument(["email", "phone", "whatsapp"], {
          email: pattern(EMAIL),
          phone: pattern(E164_PHONE),
          whatsapp: pattern(E164_PHONE),
        }),
        status: oneOf("active", "suspended", "canceled"),
        createdAt: date,
      }
    ),
    indexes: [{ key: { taxId: 1 }, name: "unique_tax_id", unique: true }],
  },

  {
    // Plano de cada corretora (histórico: um documento por assinatura)
    name: "plans",
    validator: document(
      [
        "brokerageId", "planName", "monthlyPrice", "includedAiTokens", "includedMessages",
        "maxUsers", "status", "startedAt", "renewsAt", "canceledAt",
      ],
      {
        brokerageId: objectId,
        planName: oneOf("starter", "pro", "business"),
        monthlyPrice: money,
        includedAiTokens: count, // franquia de tokens de IA por mês
        includedMessages: count, // franquia de mensagens por mês
        maxUsers: { bsonType: "int", minimum: 1 },
        status: oneOf("active", "canceled"),
        startedAt: date,
        renewsAt: dateOrNull,
        canceledAt: dateOrNull,
      }
    ),
    indexes: [
      { key: { brokerageId: 1, status: 1 }, name: "brokerage_status" },
      {
        // No máximo UM plano ativo por corretora
        key: { brokerageId: 1 },
        name: "one_active_plan_per_brokerage",
        unique: true,
        partialFilterExpression: { status: "active" },
      },
    ],
  },

  {
    // Usuários do painel (dono, admin, atendente)
    name: "users",
    validator: document(["name", "email", "phone", "memberships", "createdAt"], {
      name: string,
      email: pattern(EMAIL),
      phone: pattern(E164_PHONE),
      memberships: {
        bsonType: "array",
        minItems: 1,
        items: subdocument(["brokerageId", "role", "joinedAt"], {
          brokerageId: objectId,
          role: oneOf("owner", "admin", "agent"),
          joinedAt: date,
        }),
      },
      createdAt: date,
    }),
    indexes: [
      { key: { email: 1 }, name: "unique_email", unique: true },
      { key: { "memberships.brokerageId": 1 }, name: "membership_brokerage" },
    ],
  },

  {
    // Conexão de cada corretora com cada seguradora
    name: "insurers",
    validator: document(
      ["brokerageId", "insurerName", "status", "capabilities", "connectedAt", "lastSyncAt"],
      {
        brokerageId: objectId,
        insurerName: string,
        status: oneOf("connected", "disconnected", "error"),
        capabilities: {
          bsonType: "array",
          uniqueItems: true,
          items: oneOf("bank_slip_copy", "policy_lookup", "claim_status", "roadside_assistance"),
        },
        connectedAt: date,
        lastSyncAt: dateOrNull,
        lastError: string,
      }
    ),
    indexes: [
      {
        key: { brokerageId: 1, insurerName: 1 },
        name: "one_connection_per_insurer",
        unique: true,
      },
    ],
  },

  {
    // Clientes finais que falam com a corretora pelo WhatsApp
    name: "customers",
    validator: document(["brokerageId", "name", "whatsappNumber", "labelIds", "createdAt"], {
      brokerageId: objectId,
      name: string,
      whatsappNumber: pattern(E164_PHONE),
      taxId: pattern("^[0-9]{11}$"), // CPF só com números
      email: pattern(EMAIL),
      labelIds: { bsonType: "array", uniqueItems: true, items: objectId },
      createdAt: date,
    }),
    indexes: [
      {
        key: { brokerageId: 1, whatsappNumber: 1 },
        name: "unique_whatsapp_per_brokerage",
        unique: true,
      },
    ],
  },

  {
    // Rótulos para organizar os clientes
    name: "labels",
    validator: document(["brokerageId", "name", "color", "createdAt"], {
      brokerageId: objectId,
      name: string,
      color: pattern("^#[0-9A-Fa-f]{6}$"),
      createdAt: date,
    }),
    indexes: [
      { key: { brokerageId: 1, name: 1 }, name: "unique_label_per_brokerage", unique: true },
    ],
  },

  {
    // Consumo de tudo (IA + mensagens) com o preço de cada.
    // Regras de preço:
    //   IA:        totalPrice = quantity / 1.000.000 x unitPrice  (unitPrice é por 1 milhão de tokens)
    //   Mensagens: totalPrice = quantity x unitPrice              (unitPrice é por mensagem)
    //   quantity = includedQuantity (franquia do plano) + overageQuantity (excedente)
    //   overagePrice = preço só do excedente, que é descontado da carteira (wallet)
    name: "usage",
    validator: {
      ...document(
        [
          "brokerageId", "customerId", "type", "quantity", "unit", "unitPrice", "totalPrice",
          "includedQuantity", "overageQuantity", "overagePrice", "usedAt",
        ],
        {
          brokerageId: objectId,
          customerId: objectId,
          type: oneOf("ai_tokens", "message_sent", "message_received"),
          quantity: { bsonType: "int", minimum: 1 },
          unit: oneOf("per_1m_tokens", "per_message"),
          unitPrice: money,
          totalPrice: money,
          includedQuantity: count,
          overageQuantity: count,
          overagePrice: money,
          model: string, // só para IA
          usedAt: date,
        }
      ),
      // A unidade tem que combinar com o tipo, e o excedente + franquia tem que dar a quantidade
      $and: [
        {
          $or: [
            { type: "ai_tokens", unit: "per_1m_tokens", model: { $exists: true } },
            {
              type: { $in: ["message_sent", "message_received"] },
              unit: "per_message",
              model: { $exists: false },
            },
          ],
        },
        { $expr: { $eq: ["$quantity", { $add: ["$includedQuantity", "$overageQuantity"] }] } },
      ],
    },
    indexes: [{ key: { brokerageId: 1, type: 1, usedAt: 1 }, name: "brokerage_type_date" }],
  },

  {
    // Carteira de cada corretora: saldo e limite de negativado
    name: "wallet",
    validator: document(
      ["brokerageId", "balance", "overdraftLimit", "currency", "status", "updatedAt"],
      {
        brokerageId: objectId,
        balance: money, // pode ficar negativo, até o overdraftLimit
        overdraftLimit: money, // quanto a corretora pode ficar negativa
        currency: oneOf("BRL"),
        status: oneOf("ok", "negative", "blocked"),
        updatedAt: date,
      }
    ),
    indexes: [{ key: { brokerageId: 1 }, name: "one_wallet_per_brokerage", unique: true }],
  },

  {
    // Todas as faturas: mensalidade do plano e recarga da carteira
    name: "invoices",
    validator: {
      ...document(
        [
          "brokerageId", "type", "description", "amount", "paymentMethod", "status",
          "dueDate", "paidAt", "createdAt",
        ],
        {
          brokerageId: objectId,
          type: oneOf("plan", "wallet_top_up"),
          planId: objectId, // só quando type = "plan"
          description: string,
          amount: money,
          paymentMethod: oneOf("pix", "boleto", "credit_card"),
          status: oneOf("pending", "paid", "overdue", "canceled"),
          dueDate: date,
          paidAt: dateOrNull,
          createdAt: date,
        }
      ),
      $or: [
        { type: "plan", planId: { $exists: true } },
        { type: "wallet_top_up", planId: { $exists: false } },
      ],
    },
    indexes: [{ key: { brokerageId: 1, status: 1, dueDate: 1 }, name: "brokerage_status_due" }],
  },
];
