import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { flow_id, target_index } = await request.json();
    if (!flow_id || target_index === undefined) {
      return NextResponse.json({ error: "flow_id e target_index obrigatórios" }, { status: 400 });
    }

    // Get only this user's flows sorted by current sort_order
    const { data: userFlows, error: fetchError } = await supabase
      .from("flows")
      .select("id, sort_order")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true });

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

    // Find current index of the flow within user's flows
    const currentIdx = userFlows.findIndex((f) => f.id === flow_id);
    if (currentIdx === -1) return NextResponse.json({ error: "Fluxo não encontrado" }, { status: 404 });

    const target = Math.max(0, Math.min(userFlows.length - 1, target_index));
    if (currentIdx === target) return NextResponse.json({ ok: true });

    // Remove from current position and insert at target
    const [moved] = userFlows.splice(currentIdx, 1);
    userFlows.splice(target, 0, moved);

    // Update sort_orders only for this user's flows
    const updates = userFlows.map((f, i) =>
      supabase.from("flows").update({ sort_order: i }).eq("id", f.id)
    );
    await Promise.all(updates);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
