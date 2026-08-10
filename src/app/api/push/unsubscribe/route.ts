import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Remove a inscrição de push (usuário desativou as notificações).
export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json();
    const endpoint = body?.endpoint;
    const admin = createAdminClient();

    let query = admin.from("push_subscriptions").delete().eq("user_id", user.id);
    if (endpoint) query = query.eq("endpoint", endpoint); // só essa inscrição; sem endpoint = todas do usuário
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
