"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/chat/Avatar";
import CreateSellerModal from "@/components/sellers/CreateSellerModal";
import EditSellerModal from "@/components/sellers/EditSellerModal";

interface Seller {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  is_active: boolean;
  instancia: string | null;
  evohub_channel_id?: string | null;
  created_at: string;
}

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  supervisor: "Supervisor",
  operator: "Operador",
};

export default function VendedoresPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Seller | null>(null);

  const fetchSellers = async () => {
    const res = await fetch("/api/sellers");
    const data = await res.json();
    setSellers(data);
  };

  useEffect(() => { fetchSellers(); }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendedores</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{sellers.length} vendedores cadastrados</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Novo vendedor
        </button>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Vendedor</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Email</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Função</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Instância</th>
              <th className="text-left p-4 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="text-right p-4 font-medium text-gray-500 dark:text-gray-400">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sellers.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    {s.avatar_url ? (
                      <img src={s.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                    ) : (
                      <Avatar name={s.name} size="sm" />
                    )}
                    <p className="font-medium text-gray-900 dark:text-white">{s.name}</p>
                  </div>
                </td>
                <td className="p-4 text-gray-500 dark:text-gray-400">{s.email || "—"}</td>
                <td className="p-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    s.role === "admin" ? "bg-red-100 text-red-600 dark:bg-red-600/20 dark:text-red-400" :
                    s.role === "supervisor" ? "bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400" :
                    "bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
                  }`}>{roleLabels[s.role] || s.role}</span>
                </td>
                <td className="p-4">
                  {s.instancia ? (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">{s.instancia}</span>
                  ) : <span className="text-gray-400">—</span>}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.is_active ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
                    <span className={`w-2 h-2 rounded-full ${s.is_active ? "bg-green-500" : "bg-gray-400"}`} />
                    {s.is_active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => setEditing(s)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition text-sm font-medium">Editar</button>
                </td>
              </tr>
            ))}
            {sellers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-12 text-center text-gray-400">
                  Nenhum vendedor cadastrado. Clique em "Novo vendedor" para começar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && <CreateSellerModal onClose={() => setShowCreate(false)} onCreated={fetchSellers} />}
      {editing && <EditSellerModal seller={editing} onClose={() => setEditing(null)} onUpdated={fetchSellers} />}
    </div>
  );
}
