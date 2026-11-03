// Consultas de demonstração em cima dos dados de exemplo.
//   npm run queries
import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";
import { requireMongoUri } from "./config.js";

// Traz o nome fantasia da corretora para dentro do resultado
const withBrokerageName = [
  { $lookup: { from: "brokerages", localField: "brokerageId", foreignField: "_id", as: "brokerage" } },
  { $set: { brokerage: { $first: "$brokerage.tradeName" } } },
];

export async function runQueries(db) {
  // 1) Plano ativo de cada corretora
  const activePlans = await db
    .collection("plans")
    .aggregate([
      { $match: { status: "active" } },
      ...withBrokerageName,
      { $project: { _id: 0, brokerage: 1, planName: 1, monthlyPrice: 1, includedAiTokens: 1, includedMessages: 1 } },
      { $sort: { brokerage: 1 } },
    ])
    .toArray();

  // 2) Consumo do mês por corretora e por tipo, com preço total e excedente
  const monthlyUsage = await db
    .collection("usage")
    .aggregate([
      {
        $group: {
          _id: {
            brokerageId: "$brokerageId",
            month: { $dateToString: { date: "$usedAt", format: "%Y-%m" } },
            type: "$type",
          },
          quantity: { $sum: "$quantity" },
          totalPrice: { $sum: "$totalPrice" },
          overageQuantity: { $sum: "$overageQuantity" },
          overagePrice: { $sum: "$overagePrice" },
        },
      },
      { $set: { brokerageId: "$_id.brokerageId", month: "$_id.month", type: "$_id.type" } },
      ...withBrokerageName,
      { $project: { _id: 0, brokerageId: 0 } },
      { $sort: { brokerage: 1, month: 1, type: 1 } },
    ])
    .toArray();

  // 3) Carteiras: saldo, limite de negativado e quanto ainda pode gastar
  const wallets = await db
    .collection("wallet")
    .aggregate([
      ...withBrokerageName,
      {
        $project: {
          _id: 0,
          brokerage: 1,
          balance: 1,
          overdraftLimit: 1,
          available: { $add: ["$balance", "$overdraftLimit"] },
          status: 1,
        },
      },
      { $sort: { brokerage: 1 } },
    ])
    .toArray();

  // 4) Faturas em aberto (planos e recargas)
  const openInvoices = await db
    .collection("invoices")
    .aggregate([
      { $match: { status: { $in: ["pending", "overdue"] } } },
      ...withBrokerageName,
      { $project: { _id: 0, brokerage: 1, type: 1, description: 1, amount: 1, dueDate: 1, status: 1 } },
      { $sort: { dueDate: 1 } },
    ])
    .toArray();

  // 5) Seguradoras com problema de conexão
  const insurerErrors = await db
    .collection("insurers")
    .aggregate([
      { $match: { status: { $ne: "connected" } } },
      ...withBrokerageName,
      { $project: { _id: 0, brokerage: 1, insurerName: 1, status: 1, lastError: 1 } },
    ])
    .toArray();

  return { activePlans, monthlyUsage, wallets, openInvoices, insurerErrors };
}

// Decimal128 e Date aparecem como texto na tabela
function printable(rows) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        value instanceof Date ? value.toISOString().slice(0, 10) : value?._bsontype === "Decimal128" ? value.toString() : value,
      ])
    )
  );
}

async function main() {
  const client = new MongoClient(requireMongoUri());
  try {
    await client.connect();
    const results = await runQueries(client.db());
    const titles = {
      activePlans: "Plano ativo de cada corretora",
      monthlyUsage: "Consumo por mês e tipo (preço total e excedente)",
      wallets: "Carteiras (saldo, limite de negativado, disponível)",
      openInvoices: "Faturas em aberto",
      insurerErrors: "Seguradoras com problema",
    };
    for (const [key, rows] of Object.entries(results)) {
      console.log(`\n== ${titles[key]} ==`);
      console.table(printable(rows));
    }
  } finally {
    await client.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error("Falhou:", error.message);
    process.exit(1);
  });
}
