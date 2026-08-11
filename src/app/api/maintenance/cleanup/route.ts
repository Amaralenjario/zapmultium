import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Retenção: mantém o banco magro (rodado por cron diário do Vercel).
// Só apaga DADOS ANTIGOS não-críticos (logs de fluxo e execuções já terminadas) —
// seguro chamar a qualquer momento. Conversas/mensagens/clientes NUNCA são tocados.
export async function GET() {
  try {
    const admin = createAdminClient();
    const now = Date.now();
    const logsCutoff = new Date(now - 14 * 864e5).toISOString();  // logs de fluxo > 14 dias
    const execCutoff = new Date(now - 30 * 864e5).toISOString();  // execuções TERMINADAS > 30 dias

    // Logs de execução de fluxo antigos (só rastro, não afeta operação).
    const { count: logs } = await admin
      .from("flow_execution_logs")
      .delete({ count: "estimated" })
      .lt("created_at", logsCutoff);

    // Execuções já terminais (completed/error) antigas — nunca mexe nas ativas.
    const { count: execs } = await admin
      .from("flow_executions")
      .delete({ count: "estimated" })
      .in("status", ["completed", "error"])
      .lt("updated_at", execCutoff);

    return NextResponse.json({ ok: true, deleted: { flow_execution_logs: logs || 0, flow_executions: execs || 0 } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
