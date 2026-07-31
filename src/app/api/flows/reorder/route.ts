import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  try {
    const { flow_id, target_index } = await request.json();
    if (!flow_id || target_index === undefined) {
      return NextResponse.json({ error: "flow_id e target_index obrigatórios" }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get all flows sorted by current sort_order
    const { data: allFlows, error: fetchError } = await supabase
      .from("flows")
      .select("id, sort_order")
      .order("sort_order", { ascending: true });

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    // Find current index of the flow
    const currentIdx = allFlows.findIndex((f) => f.id === flow_id);
    if (currentIdx === -1) return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 });

    const target = Math.max(0, Math.min(allFlows.length - 1, target_index));
    if (currentIdx === target) return NextResponse.json({ ok: true });

    // Remove from current position and insert at target
    const [moved] = allFlows.splice(currentIdx, 1);
    allFlows.splice(target, 0, moved);

    // Update all sort_orders
    const updates = allFlows.map((f, i) => supabase.from("flows").update({ sort_order: i }).eq("id", f.id));
    await Promise.all(updates);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
