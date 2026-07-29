const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error("Defina SUPABASE_ACCESS_TOKEN"); process.exit(1); }
const URL = "https://api.supabase.com/v1/projects/ryurgbutqcgmicqqvols/database/query";

async function exec(sql) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const data = await r.json();
  if (!r.ok) {
    console.log("  ERRO:", JSON.stringify(data).substring(0, 200));
  }
  return r.ok;
}

async function main() {
  console.log("=== CRIANDO TABELAS ===");

  // 1. Profiles
  console.log("1/7 profiles...");
  await exec(`
    CREATE TABLE IF NOT EXISTS public.profiles (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'supervisor')),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await exec(`ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY`);

  // 2. Customers
  console.log("2/7 customers...");
  await exec(`
    CREATE TABLE IF NOT EXISTS public.customers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      avatar_url TEXT,
      tags TEXT[] DEFAULT '{}',
      notes TEXT,
      metadata JSONB DEFAULT '{}',
      last_interaction_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
    CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);
  `);
  await exec(`ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY`);

  // 3. Conversations
  console.log("3/7 conversations...");
  await exec(`
    CREATE TABLE IF NOT EXISTS public.conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
      assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'pending', 'archived')),
      source TEXT DEFAULT 'whatsapp',
      last_message TEXT,
      last_message_at TIMESTAMPTZ,
      unread_count INTEGER DEFAULT 0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_conversations_customer ON public.conversations(customer_id);
    CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON public.conversations(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_conversations_status ON public.conversations(status);
  `);
  await exec(`ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY`);

  // 4. Messages
  console.log("4/7 messages...");
  await exec(`
    CREATE TABLE IF NOT EXISTS public.messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'system', 'bot')),
      sender_id UUID,
      content TEXT NOT NULL,
      content_type TEXT DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'video', 'audio', 'document', 'location', 'template')),
      metadata JSONB DEFAULT '{}',
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON public.messages(created_at);
  `);
  await exec(`ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY`);

  // 5. Leads (CRM)
  console.log("5/7 leads...");
  await exec(`
    CREATE TABLE IF NOT EXISTS public.leads (
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
    );
    CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
  `);
  await exec(`ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY`);

  // 6. Flows
  console.log("6/7 flows...");
  await exec(`
    CREATE TABLE IF NOT EXISTS public.flows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      description TEXT,
      trigger_type TEXT NOT NULL CHECK (trigger_type IN ('keyword', 'first_message', 'welcome', 'schedule', 'manual', 'webhook')),
      trigger_value TEXT,
      status TEXT DEFAULT 'draft' CHECK (status IN ('active', 'inactive', 'draft')),
      config JSONB DEFAULT '{}',
      created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_flows_status ON public.flows(status);
  `);
  await exec(`ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY`);

  // 7. Flow Executions
  console.log("7/7 flow_executions...");
  await exec(`
    CREATE TABLE IF NOT EXISTS public.flow_executions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
      customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
      conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
      current_step INTEGER DEFAULT 0,
      total_steps INTEGER DEFAULT 0,
      variables JSONB DEFAULT '{}',
      error_message TEXT,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_flow_executions_flow ON public.flow_executions(flow_id);
    CREATE INDEX IF NOT EXISTS idx_flow_executions_customer ON public.flow_executions(customer_id);
  `);
  await exec(`ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY`);

  console.log("\n=== TRIGGERS updated_at ===");
  await exec(`
    CREATE OR REPLACE FUNCTION public.update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  for (const table of ["profiles", "customers", "conversations", "leads", "flows"]) {
    console.log("  trigger -> " + table);
    await exec("DROP TRIGGER IF EXISTS trg_updated_at ON public." + table);
    await exec("CREATE TRIGGER trg_updated_at BEFORE UPDATE ON public." + table + " FOR EACH ROW EXECUTE FUNCTION public.update_updated_at()");
  }

  console.log("\n=== RLS POLICIES ===");
  await exec(`
    CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  `);

  for (const table of ["customers", "conversations", "messages", "leads", "flows", "flow_executions"]) {
    console.log("  policy -> " + table);
    await exec("CREATE POLICY \"Allow all for authenticated\" ON public." + table + " FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated')");
  }

  console.log("\n=== AUTO-PROFILE TRIGGER ===");
  await exec(`
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS TRIGGER AS $$
    BEGIN
      INSERT INTO public.profiles (id, full_name, role)
      VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'operator')
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  await exec("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users");
  await exec("CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()");

  console.log("\n=== TUDO PRONTO! ===");
}

main().catch((e) => console.log("FATAL:", e.message));
