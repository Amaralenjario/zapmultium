import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    ok: !!(url && key),
    hasUrl: !!url,
    hasServiceKey: !!key,
    message: (url && key) ? "SUPABASE_SERVICE_ROLE_KEY configurada corretamente" : "SUPABASE_SERVICE_ROLE_KEY NÃO configurada! Vá em Vercel > Settings > Environment Variables e adicione a variável."
  });
}
