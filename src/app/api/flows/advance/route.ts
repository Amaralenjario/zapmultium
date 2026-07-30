import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { execution_id } = await request.json();
    if (!execution_id) {
      return NextResponse.json({ error: "execution_id obrigatório" }, { status: 400 });
    }

    const { processFlowStep } = await import("@/lib/flow-engine");
    const result = await processFlowStep(execution_id);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET endpoint for the scheduler cron job
export async function GET() {
  try {
    const { advanceExpiredExecutions } = await import("@/lib/flow-engine");
    const advanced = await advanceExpiredExecutions();
    return NextResponse.json({ ok: true, advanced });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
