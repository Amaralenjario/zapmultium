import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({
      ok: false,
      error: "Variáveis de ambiente não configuradas no Vercel",
      missing: [!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean),
    });
  }

  try {
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1 });
    if (error) {
      return NextResponse.json({ ok: false, error: `Erro ao acessar Admin API: ${error.message}`, code: error.status });
    }
    return NextResponse.json({ ok: true, users: data.users.length, message: "Service Role Key funcionando" });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}
