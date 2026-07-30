require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const URL = "https://api.supabase.com/v1/projects/ryurgbutqcgmicqqvols/database/query";

async function exec(sql) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  if (r.status !== 200 && r.status !== 201) {
    const d = await r.json();
    console.log("  ERRO:", JSON.stringify(d).substring(0, 150));
  }
  return r.json();
}

async function main() {
  console.log("=== VINCULANDO PHONE NUMBERS ÀS OPERAÇÕES ===\n");

  const mappings = [
    { op: "VH", phone_id: "897878513398151" },
    { op: "GUSTAVO", phone_id: "892228177298374" },
    { op: "AMANDA", phone_id: "1034222499765101" },
    { op: "GABI", phone_id: "976034132269824" },
  ];

  for (const m of mappings) {
    await exec(`
      UPDATE public.operations_channels
      SET phone_number_id = '${m.phone_id}'
      FROM public.operations
      WHERE operations.id = operations_channels.operation_id
        AND operations.slug = '${m.op.toLowerCase()}'
    `);
    console.log(`  ${m.op} -> ${m.phone_id}`);
  }

  console.log("\n=== PRONTO ===");
}

main().catch(console.error);
