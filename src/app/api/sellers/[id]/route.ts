import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { name, role, is_active, instancia, email, password } = await request.json();

  // Atualizar profile
  const profileUpdates: any = {};
  if (name !== undefined) profileUpdates.full_name = name;
  if (role !== undefined) profileUpdates.role = role;
  if (is_active !== undefined) profileUpdates.is_active = is_active;

  if (Object.keys(profileUpdates).length > 0) {
    await supabase.from("profiles").update(profileUpdates).eq("id", params.id);
  }

  // Atualizar auth user se email ou senha
  if (email || password) {
    const authUpdates: any = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;
    await supabase.auth.admin.updateUserById(params.id, authUpdates);
  }

  // Atualizar vendedores se instancia
  if (instancia !== undefined) {
    const { data: existing } = await supabase.from("vendedores").select("id").eq("id", params.id).limit(1);
    if (existing && existing.length > 0) {
      await supabase.from("vendedores").update({ instancia_evolution: instancia }).eq("id", params.id);
    } else {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", params.id).single();
      await supabase.from("vendedores").insert({ id: params.id, nome: profile?.full_name || name || "", instancia_evolution: instancia });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  // Desativar usuário (soft delete)
  await supabase.from("profiles").update({ is_active: false }).eq("id", params.id);
  await supabase.auth.admin.deleteUser(params.id);
  return NextResponse.json({ ok: true });
}
