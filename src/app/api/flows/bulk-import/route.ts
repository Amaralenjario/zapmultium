import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { text } = await request.json();
  if (!text) return NextResponse.json({ error: "Texto obrigatório" }, { status: 400 });

  const { importFlowV1 } = await import("@/lib/flow-export");

  // Parse multiple flows: # [ZV] Name \n FLOWV1:...
  const blocks = text.split(/(?=^# )/m).filter(Boolean);
  const results: any[] = [];

  for (const block of blocks) {
    const nameMatch = block.match(/^#\s+(.+)/m);
    const flowMatch = block.match(/FLOWV1:[A-Za-z0-9+/=]+/);
    
    if (!flowMatch) continue;
    
    const flowName = nameMatch?.[1]?.trim() || "Fluxo importado";
    const result = importFlowV1(flowMatch[0]);
    
    if (!result) {
      results.push({ name: flowName, error: "Código inválido" });
      continue;
    }

    // Save to database
    const { createClient: createAdmin } = await import("@supabase/supabase-js");
    const adminClient = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check for duplicate name and generate unique name
    let finalName = flowName;
    let copyNum = 1;
    while (true) {
      const { data: existing } = await adminClient.from("flows").select("id").eq("name", finalName).limit(1);
      if (!existing || existing.length === 0) break;
      copyNum++;
      finalName = `${flowName} (cópia ${copyNum})`;
    }

    const { data, error } = await adminClient
      .from("flows")
      .insert({
        name: finalName,
        config: { steps: result.steps, edges: result.edges },
        trigger_type: "manual",
        status: "draft",
        user_id: user.id,
      })
      .select("*")
      .single();

    if (error) {
      results.push({ name: flowName, error: error.message });
    } else {
      results.push({ name: finalName, id: data.id, steps: result.steps.length });
    }
  }

  return NextResponse.json({ imported: results.length, results });
}
