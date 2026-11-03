// Documentos de exemplo: 2 corretoras fictícias com plano, usuários, seguradoras,
// clientes, rótulos, consumo, carteira e faturas.
// Todos os dados (CNPJ, CPF, telefones, e-mails) são inventados.
import { Decimal128, ObjectId } from "mongodb";

const brl = (value) => Decimal128.fromString(value);
const at = (iso) => new Date(iso);

// Preços de exemplo (ilustrativos)
const AI_PRICE_PER_1M_TOKENS = "25.00"; // R$ por 1 milhão de tokens
const MESSAGE_SENT_PRICE = "0.08"; // R$ por mensagem enviada
const MESSAGE_RECEIVED_PRICE = "0.02"; // R$ por mensagem recebida

// Calcula o preço com 2 casas, em centavos inteiros, para não errar arredondamento
function price(type, quantity) {
  if (quantity === 0) return "0.00";
  const cents =
    type === "ai_tokens"
      ? Math.round((quantity / 1_000_000) * Number(AI_PRICE_PER_1M_TOKENS) * 100)
      : quantity * Math.round(Number(type === "message_sent" ? MESSAGE_SENT_PRICE : MESSAGE_RECEIVED_PRICE) * 100);
  return (cents / 100).toFixed(2);
}

function usage({ brokerageId, customerId, type, quantity, includedQuantity, usedAt }) {
  const overageQuantity = quantity - includedQuantity;
  const isAi = type === "ai_tokens";
  return {
    brokerageId,
    customerId,
    type,
    quantity,
    unit: isAi ? "per_1m_tokens" : "per_message",
    unitPrice: brl(
      isAi ? AI_PRICE_PER_1M_TOKENS : type === "message_sent" ? MESSAGE_SENT_PRICE : MESSAGE_RECEIVED_PRICE
    ),
    totalPrice: brl(price(type, quantity)),
    includedQuantity,
    overageQuantity,
    overagePrice: brl(price(type, overageQuantity)),
    ...(isAi && { model: "llm-standard-v1" }),
    usedAt: at(usedAt),
  };
}

export function buildSeedData() {
  // ---------- Corretoras ----------
  const horizonte = new ObjectId();
  const cerrado = new ObjectId();

  const brokerages = [
    {
      _id: horizonte,
      legalName: "Horizonte Insurance Brokerage Ltd",
      tradeName: "Horizonte Seguros",
      taxId: "12345678000190",
      segments: ["auto", "home", "life"],
      address: {
        street: "Avenida Rondon Pacheco",
        number: "1500",
        complement: "Room 302",
        district: "Tibery",
        city: "Uberlandia",
        state: "MG",
        zipCode: "38405142",
      },
      contact: {
        email: "contact@horizonte.example",
        phone: "+553432100000",
        whatsapp: "+5534999990000",
      },
      status: "active",
      createdAt: at("2026-09-01T10:00:00Z"),
    },
    {
      _id: cerrado,
      legalName: "Cerrado Insurance Brokerage Ltd",
      tradeName: "Cerrado Seguros",
      taxId: "98765432000110",
      segments: ["auto", "health", "business"],
      address: {
        street: "Rua da Bahia",
        number: "820",
        district: "Centro",
        city: "Belo Horizonte",
        state: "MG",
        zipCode: "30160011",
      },
      contact: {
        email: "hello@cerrado.example",
        phone: "+553130000000",
        whatsapp: "+5531988880000",
      },
      status: "active",
      createdAt: at("2026-10-01T14:30:00Z"),
    },
  ];

  // ---------- Planos (Horizonte começou no Starter e mudou para o Pro) ----------
  const horizonteStarter = new ObjectId();
  const horizontePro = new ObjectId();
  const cerradoStarter = new ObjectId();

  const plans = [
    {
      _id: horizonteStarter,
      brokerageId: horizonte,
      planName: "starter",
      monthlyPrice: brl("197.00"),
      includedAiTokens: 500_000,
      includedMessages: 300,
      maxUsers: 2,
      status: "canceled",
      startedAt: at("2026-09-01T10:00:00Z"),
      renewsAt: null,
      canceledAt: at("2026-09-30T23:59:59Z"),
    },
    {
      _id: horizontePro,
      brokerageId: horizonte,
      planName: "pro",
      monthlyPrice: brl("497.00"),
      includedAiTokens: 2_000_000,
      includedMessages: 1_000,
      maxUsers: 5,
      status: "active",
      startedAt: at("2026-10-01T00:00:00Z"),
      renewsAt: at("2026-11-01T00:00:00Z"),
      canceledAt: null,
    },
    {
      _id: cerradoStarter,
      brokerageId: cerrado,
      planName: "starter",
      monthlyPrice: brl("197.00"),
      includedAiTokens: 500_000,
      includedMessages: 300,
      maxUsers: 2,
      status: "active",
      startedAt: at("2026-10-01T14:30:00Z"),
      renewsAt: at("2026-11-01T14:30:00Z"),
      canceledAt: null,
    },
  ];

  // ---------- Usuários ----------
  const users = [
    {
      name: "Ana Ribeiro",
      email: "ana@horizonte.example",
      phone: "+5534999991111",
      memberships: [{ brokerageId: horizonte, role: "owner", joinedAt: at("2026-09-01T10:00:00Z") }],
      createdAt: at("2026-09-01T10:00:00Z"),
    },
    {
      name: "Bruno Lima",
      email: "bruno@horizonte.example",
      phone: "+5534999992222",
      memberships: [{ brokerageId: horizonte, role: "agent", joinedAt: at("2026-09-05T09:00:00Z") }],
      createdAt: at("2026-09-05T09:00:00Z"),
    },
    {
      // Uma consultora que trabalha para as duas corretoras
      name: "Carla Souza",
      email: "carla@consulting.example",
      phone: "+5531999993333",
      memberships: [
        { brokerageId: horizonte, role: "admin", joinedAt: at("2026-09-10T08:00:00Z") },
        { brokerageId: cerrado, role: "owner", joinedAt: at("2026-10-01T14:30:00Z") },
      ],
      createdAt: at("2026-09-10T08:00:00Z"),
    },
  ];

  // ---------- Seguradoras conectadas ----------
  const insurers = [
    {
      brokerageId: horizonte,
      insurerName: "Porto Seguro",
      status: "connected",
      capabilities: ["bank_slip_copy", "policy_lookup", "claim_status", "roadside_assistance"],
      connectedAt: at("2026-09-02T11:00:00Z"),
      lastSyncAt: at("2026-10-28T06:00:00Z"),
    },
    {
      brokerageId: horizonte,
      insurerName: "Allianz",
      status: "connected",
      capabilities: ["bank_slip_copy", "policy_lookup"],
      connectedAt: at("2026-09-03T15:20:00Z"),
      lastSyncAt: at("2026-10-28T06:05:00Z"),
    },
    {
      brokerageId: cerrado,
      insurerName: "Tokio Marine",
      status: "error",
      capabilities: ["bank_slip_copy", "claim_status"],
      connectedAt: at("2026-10-02T10:00:00Z"),
      lastSyncAt: null,
      lastError: "Invalid credentials: the insurer rejected the API key",
    },
  ];

  // ---------- Rótulos ----------
  const urgent = new ObjectId();
  const renewal = new ObjectId();
  const vip = new ObjectId();
  const labels = [
    { _id: urgent, brokerageId: horizonte, name: "Urgent", color: "#E5484D", createdAt: at("2026-09-02T12:00:00Z") },
    { _id: renewal, brokerageId: horizonte, name: "Renewal", color: "#3E63DD", createdAt: at("2026-09-02T12:01:00Z") },
    { _id: vip, brokerageId: cerrado, name: "VIP", color: "#FFB224", createdAt: at("2026-10-02T09:00:00Z") },
  ];

  // ---------- Clientes ----------
  const joao = new ObjectId();
  const maria = new ObjectId();
  const pedro = new ObjectId();
  const customers = [
    {
      _id: joao,
      brokerageId: horizonte,
      name: "Joao Pereira",
      whatsappNumber: "+5534988881111",
      taxId: "11122233344",
      labelIds: [renewal],
      createdAt: at("2026-09-15T13:00:00Z"),
    },
    {
      _id: maria,
      brokerageId: horizonte,
      name: "Maria Oliveira",
      whatsappNumber: "+5534988882222",
      taxId: "55566677788",
      email: "maria.oliveira@mail.example",
      labelIds: [urgent],
      createdAt: at("2026-10-03T08:45:00Z"),
    },
    {
      _id: pedro,
      brokerageId: cerrado,
      name: "Pedro Santos",
      whatsappNumber: "+5531977773333",
      labelIds: [vip],
      createdAt: at("2026-10-05T17:10:00Z"),
    },
  ];

  // ---------- Consumo (IA + mensagens) ----------
  const usageDocs = [
    // Horizonte: dentro da franquia
    usage({ brokerageId: horizonte, customerId: joao, type: "message_received", quantity: 1, includedQuantity: 1, usedAt: "2026-10-05T12:00:00Z" }),
    usage({ brokerageId: horizonte, customerId: joao, type: "ai_tokens", quantity: 12_400, includedQuantity: 12_400, usedAt: "2026-10-05T12:00:03Z" }),
    usage({ brokerageId: horizonte, customerId: joao, type: "message_sent", quantity: 1, includedQuantity: 1, usedAt: "2026-10-05T12:00:04Z" }),
    // Horizonte: a franquia de IA acabou no meio desta resposta (50 mil na franquia, 100 mil de excedente)
    usage({ brokerageId: horizonte, customerId: maria, type: "message_received", quantity: 1, includedQuantity: 1, usedAt: "2026-10-29T18:20:00Z" }),
    usage({ brokerageId: horizonte, customerId: maria, type: "ai_tokens", quantity: 150_000, includedQuantity: 50_000, usedAt: "2026-10-29T18:20:05Z" }),
    usage({ brokerageId: horizonte, customerId: maria, type: "message_sent", quantity: 1, includedQuantity: 0, usedAt: "2026-10-29T18:20:06Z" }),
    // Cerrado: a franquia de IA e a de mensagens já acabaram, tudo é excedente
    usage({ brokerageId: cerrado, customerId: pedro, type: "message_received", quantity: 2, includedQuantity: 0, usedAt: "2026-10-30T09:00:00Z" }),
    usage({ brokerageId: cerrado, customerId: pedro, type: "ai_tokens", quantity: 300_000, includedQuantity: 0, usedAt: "2026-10-30T09:00:04Z" }),
    usage({ brokerageId: cerrado, customerId: pedro, type: "ai_tokens", quantity: 250_000, includedQuantity: 0, usedAt: "2026-10-30T09:05:10Z" }),
    usage({ brokerageId: cerrado, customerId: pedro, type: "message_sent", quantity: 1, includedQuantity: 0, usedAt: "2026-10-30T09:05:11Z" }),
  ];

  // ---------- Carteiras ----------
  // Saldo = recargas pagas - excedentes cobrados
  //   Horizonte: 200.00 - (2.50 + 0.08)          = 197.42
  //   Cerrado:    10.00 - (0.04 + 7.50 + 6.25 + 0.08) = -3.87 (negativado, dentro do limite de 30.00)
  const wallet = [
    {
      brokerageId: horizonte,
      balance: brl("197.42"),
      overdraftLimit: brl("50.00"),
      currency: "BRL",
      status: "ok",
      updatedAt: at("2026-10-29T18:20:06Z"),
    },
    {
      brokerageId: cerrado,
      balance: brl("-3.87"),
      overdraftLimit: brl("30.00"),
      currency: "BRL",
      status: "negative",
      updatedAt: at("2026-10-30T09:05:11Z"),
    },
  ];

  // ---------- Faturas (planos + recargas da carteira) ----------
  const invoices = [
    {
      brokerageId: horizonte, type: "plan", planId: horizonteStarter,
      description: "Starter plan - September 2026", amount: brl("197.00"), paymentMethod: "boleto",
      status: "paid", dueDate: at("2026-09-05T00:00:00Z"), paidAt: at("2026-09-04T16:00:00Z"),
      createdAt: at("2026-09-01T10:00:00Z"),
    },
    {
      brokerageId: horizonte, type: "plan", planId: horizontePro,
      description: "Pro plan - October 2026", amount: brl("497.00"), paymentMethod: "pix",
      status: "paid", dueDate: at("2026-10-05T00:00:00Z"), paidAt: at("2026-10-01T09:30:00Z"),
      createdAt: at("2026-10-01T00:00:00Z"),
    },
    {
      brokerageId: horizonte, type: "plan", planId: horizontePro,
      description: "Pro plan - November 2026", amount: brl("497.00"), paymentMethod: "pix",
      status: "pending", dueDate: at("2026-11-05T00:00:00Z"), paidAt: null,
      createdAt: at("2026-11-01T00:00:00Z"),
    },
    {
      brokerageId: horizonte, type: "wallet_top_up",
      description: "Wallet top-up", amount: brl("200.00"), paymentMethod: "pix",
      status: "paid", dueDate: at("2026-10-02T00:00:00Z"), paidAt: at("2026-10-01T09:35:00Z"),
      createdAt: at("2026-10-01T09:34:00Z"),
    },
    {
      brokerageId: cerrado, type: "plan", planId: cerradoStarter,
      description: "Starter plan - October 2026", amount: brl("197.00"), paymentMethod: "credit_card",
      status: "paid", dueDate: at("2026-10-01T14:30:00Z"), paidAt: at("2026-10-01T14:31:00Z"),
      createdAt: at("2026-10-01T14:30:00Z"),
    },
    {
      brokerageId: cerrado, type: "wallet_top_up",
      description: "Wallet top-up", amount: brl("10.00"), paymentMethod: "pix",
      status: "paid", dueDate: at("2026-10-02T00:00:00Z"), paidAt: at("2026-10-01T15:00:00Z"),
      createdAt: at("2026-10-01T14:59:00Z"),
    },
    {
      brokerageId: cerrado, type: "wallet_top_up",
      description: "Wallet top-up to clear negative balance", amount: brl("100.00"), paymentMethod: "boleto",
      status: "pending", dueDate: at("2026-11-04T00:00:00Z"), paidAt: null,
      createdAt: at("2026-10-30T09:10:00Z"),
    },
  ];

  return {
    brokerages,
    plans,
    users,
    insurers,
    customers,
    labels,
    usage: usageDocs,
    wallet,
    invoices,
  };
}
