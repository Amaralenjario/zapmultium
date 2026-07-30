import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";

// Add tag to lead - moves lead to tag's column
export async function POST(request: Request, { params }: { params: { leadId: string } }) {
  const serverClient = createServerClient();
  const { data: { user } } = await serverClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { tag_id } = await request.json();
  if (!tag_id) return NextResponse.json({ error: "tag_id obrigatório" }, { status: 400 });

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Get tag info
  const { data: tag } = await adminClient.from("crm_tags").select("column_key").eq("id", tag_id).single();
  if (!tag) return NextResponse.json({ error: "Tag não encontrada" }, { status: 404 });

  // Add lead_tag
  await adminClient.from("lead_tags").upsert({ lead_id: params.leadId, tag_id });

  // Move lead to tag's column
  await adminClient.from("leads").update({ status: tag.column_key }).eq("id", params.leadId);

  return NextResponse.json({ ok: true, status: tag.column_key });
}
