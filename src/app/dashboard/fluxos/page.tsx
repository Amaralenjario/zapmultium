"use client";

import FlowBuilder from "@/components/flows/FlowBuilder";
import toast from "react-hot-toast";

export default function FluxosPage() {
  const handleSave = async (steps: any[]) => {
    const name = prompt("Nome do fluxo:");
    if (!name) return;

    const res = await fetch("/api/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config: { steps } }),
    });

    if (!res.ok) { toast.error("Erro ao salvar"); return; }
    toast.success("Fluxo salvo!");
  };

  return <FlowBuilder onSave={handleSave} />;
}
