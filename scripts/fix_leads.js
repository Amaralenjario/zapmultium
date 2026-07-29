const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error("Defina SUPABASE_ACCESS_TOKEN"); process.exit(1); }
const URL = "https://api.supabase.com/v1/projects/ryurgbutqcgmicqqvols/database/query";

async function exec(sql) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const d = await r.json();
  console.log(JSON.stringify(d, null, 2).substring(0, 600));
}

async function main() {
  // Verificar se a tabela leads existe
  console.log("=== Colunas da tabela leads ===");
  await exec("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads' AND table_schema = 'public' ORDER BY ordinal_position");

  // Recriar a tabela leads
  console.log("\n=== Recriando leads ===");
  await exec("DROP TABLE IF EXISTS public.leads CASCADE");

  await exec(`
    CREATE TABLE public.leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      source TEXT DEFAULT 'whatsapp',
      status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
      funnel_stage TEXT DEFAULT 'captura',
      priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      notes TEXT,
      assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
      conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
      metadata JSONB DEFAULT '{}',
      contacted_at TIMESTAMPTZ,
      converted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  console.log("\n=== Criando índices ===");
  await exec("CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status)");
  await exec("CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_to)");
  await exec("CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone)");
  await exec("ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY");
  await exec("CREATE POLICY \"Allow all for authenticated\" ON public.leads FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated')");

  console.log("\n=== Trigger updated_at ===");
  await exec("DROP TRIGGER IF EXISTS trg_updated_at ON public.leads");
  await exec("CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()");

  // Listar todas as tabelas
  console.log("\n=== Tabelas no schema public ===");
  await exec("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename");

  console.log("\n=== PRONTO ===");
}

main().catch((e) => console.log("FATAL:", e.message));
