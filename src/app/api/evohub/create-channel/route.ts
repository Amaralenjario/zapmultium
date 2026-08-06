import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { name, evo_account_id } = await request.json();

    if (!name) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });
    }

    // Buscar a API key da conta EvoHub selecionada
    let apiKey = process.env.EVOHUB_API_KEY;
    let apiUrl = process.env.EVOHUB_API_URL || "https://api.evohub.ai";

    if (evo_account_id) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
      const { data: account } = await supabase.from("evo_accounts").select("api_key, api_url").eq("id", evo_account_id).single();
      if (account) {
        apiKey = account.api_key;
        apiUrl = account.api_url || apiUrl;
      }
    }

    if (!apiKey) {
      return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
    }

    const res = await fetch(`${apiUrl}/api/v1/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, type: "whatsapp" }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("EvoHub create channel error:", res.status, JSON.stringify(data));
      return NextResponse.json({ error: data?.message || data?.error || JSON.stringify(data) || "Erro ao criar canal" }, { status: res.status });
    }

    return NextResponse.json({
      id: data.id,
      name: data.name,
      token: data.token,
      status: data.status,
      type: data.type,
      connectUrl: `https://app.evohub.evolutionfoundation.com.br/connect/${data.token}`,
    });
  } catch (e: any) {
    console.error("Create channel exception:", e?.message || e);
    return NextResponse.json({ error: e?.message || "Erro interno" }, { status: 500 });
  }
}
