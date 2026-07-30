require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("=== CRIANDO TABELA DE OPERAÇÕES ===\n");

  // Get EvoHub channels
  const res = await fetch("https://api.evohub.ai/api/v1/channels", {
    headers: { Authorization: `Bearer ${process.env.EVOHUB_API_KEY}` },
  });
  const { channels } = await res.json();

  // 1. Create operations table
  console.log("1. Criando tabela operations...");
  const { error: e1 } = await supabase.rpc("create_operations_table");
  if (e1) {
    // Try raw SQL via REST
    await supabase.from("_dummy").select("*").limit(1);
  }

  // Use raw SQL via management API
  const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
  if (!TOKEN) { console.log("Sem SUPABASE_ACCESS_TOKEN"); return; }

  const URL = "https://api.supabase.com/v1/projects/ryurgbutqcgmicqqvols/database/query";
  async function exec(sql) {
    const r = await fetch(URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    const d = await r.json();
    if (r.status !== 200 && r.status !== 201) console.log("  ERRO:", JSON.stringify(d).substring(0, 200));
    return d;
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS public.operations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#22c55e',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE public.operations ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all for authenticated" ON public.operations FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  `);

  // 2. Create operations_channels junction table
  await exec(`
    CREATE TABLE IF NOT EXISTS public.operations_channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      operation_id UUID NOT NULL REFERENCES public.operations(id) ON DELETE CASCADE,
      evohub_channel_id TEXT NOT NULL,
      evohub_channel_name TEXT NOT NULL,
      phone_number_id TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(operation_id, evohub_channel_id)
    );
    ALTER TABLE public.operations_channels ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow all for authenticated" ON public.operations_channels FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
  `);

  // 3. Create trigger for updated_at
  await exec("DROP TRIGGER IF EXISTS trg_updated_at ON public.operations");
  await exec("CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.operations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()");

  // 4. Seed operations from existing channels
  console.log("2. Populando operações...");

  const opsMap = [
    { name: "VH", slug: "vh", color: "#f59e0b", channels: ["VH - 1692"] },
    { name: "GABI", slug: "gabi", color: "#ec4899", channels: ["GABI - 8176"] },
    { name: "GUSTAVO", slug: "gustavo", color: "#3b82f6", channels: ["GUSTAVO - LUIS"] },
    { name: "AMANDA", slug: "amanda", color: "#8b5cf6", channels: ["AMANDA - JÉ"] },
    { name: "NC", slug: "nc", color: "#06b6d4", channels: ["NC - CAIO"] },
  ];

  for (const op of opsMap) {
    console.log(`  ${op.name}...`);
    const { data: operation } = await exec(`
      INSERT INTO public.operations (name, slug, color)
      VALUES ('${op.name}', '${op.slug}', '${op.color}')
      ON CONFLICT (slug) DO UPDATE SET name = '${op.name}', color = '${op.color}'
      RETURNING id
    `);
    const opId = operation?.[0]?.id;

    for (const chName of op.channels) {
      const ch = channels?.find((c) => c.name === chName);
      if (ch && opId) {
        await exec(`
          INSERT INTO public.operations_channels (operation_id, evohub_channel_id, evohub_channel_name)
          VALUES ('${opId}', '${ch.id}', '${ch.name}')
          ON CONFLICT DO NOTHING
        `);
      }
    }
  }

  console.log("\n=== PRONTO ===");
}

main().catch(console.error);
