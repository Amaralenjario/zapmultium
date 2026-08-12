import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Troca o VENDEDOR de um número (canal). Exclusivo: 1 vendedor por número — remove o
// canal de qualquer vendedor e (se veio user_id) atribui ao novo. Só admin/supervisor.
export async function POST(request: Request) {
  const server = createServerClient();
  const { data: { user } } = await server.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { data: profile } = await server.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "supervisor") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { evohub_channel_id, user_id } = await request.json();
  if (!evohub_channel_id) return NextResponse.json({ error: "evohub_channel_id obrigatório" }, { status: 400 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Tira o número de quem tinha (exclusivo por canal).
  await admin.from("seller_channels").delete().eq("evohub_channel_id", evohub_channel_id);
  // Atribui ao novo vendedor (user_id vazio/null = deixar sem vendedor).
  if (user_id) {
    const { error } = await admin.from("seller_channels").insert({ user_id, evohub_channel_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
