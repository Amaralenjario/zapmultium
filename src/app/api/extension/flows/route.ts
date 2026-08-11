import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveExtensionKey, CORS } from "@/lib/extension-auth";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

// Lista os fluxos do vendedor (pra extensão montar os botões). Auth por código ZPX.
export async function GET(request: Request) {
  const key = request.headers.get("x-zpx-key") || new URL(request.url).searchParams.get("key");
  const actor = await resolveExtensionKey(key);
  if (!actor) return NextResponse.json({ error: "Código inválido" }, { status: 401, headers: CORS });

  const admin = createAdminClient();
  let query = admin.from("flows").select("id, name").order("sort_order", { ascending: true, nullsFirst: false }).order("name", { ascending: true });
  // admin/supervisor veem todos; vendedor só os dele
  if (actor.role !== "admin" && actor.role !== "supervisor") {
    query = query.eq("user_id", actor.userId);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });

  const flows = (data || []).map((f: any) => ({ id: f.id, name: f.name }));
  return NextResponse.json({ flows }, { headers: CORS });
}
