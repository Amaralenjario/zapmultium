import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET() {
  // Buscar todos os profiles + dados da tabela vendedores
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, is_active, created_at");

  const { data: sellers } = await supabase.from("vendedores").select("*");

  // Merge
  const merged = (profiles || []).map((p) => {
    const seller = (sellers || []).find((s) => s.nome === p.full_name || s.id === p.id);
    return {
      id: p.id,
      name: p.full_name,
      email: "",
      avatar_url: p.avatar_url,
      role: p.role,
      is_active: p.is_active,
      instancia: seller?.instancia_evolution || null,
      created_at: p.created_at,
    };
  });

  // Também incluir vendedores sem profile
  for (const s of sellers || []) {
    if (!merged.find((m) => m.name === s.nome)) {
      merged.push({
        id: s.id,
        name: s.nome,
        email: "",
        avatar_url: null,
        role: "operator",
        is_active: true,
        instancia: s.instancia_evolution,
        created_at: s.created_at,
      });
    }
  }

  return NextResponse.json(merged);
}

export async function POST(request: Request) {
  const { name, email, password, role } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ error: "Email e senha obrigatórios" }, { status: 400 });
  }

  // Criar usuário no Auth
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  // Criar perfil
  await supabase.from("profiles").upsert({
    id: authUser.user.id,
    full_name: name,
    role: role || "operator",
  });

  return NextResponse.json({ id: authUser.user.id, name, email, role: role || "operator" }, { status: 201 });
}
