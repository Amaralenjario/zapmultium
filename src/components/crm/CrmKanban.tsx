"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Avatar from "@/components/chat/Avatar";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  status: string;
  funnel_stage: string;
  priority: string;
  notes: string | null;
  created_at: string;
}

const columns = [
  { key: "new", label: "Novos", color: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800", badge: "bg-blue-100 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400" },
  { key: "contacted", label: "Contatados", color: "bg-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950/30", border: "border-yellow-200 dark:border-yellow-800", badge: "bg-yellow-100 text-yellow-600 dark:bg-yellow-600/20 dark:text-yellow-400" },
  { key: "qualified", label: "Qualificados", color: "bg-purple-500", bg: "bg-purple-50 dark:bg-purple-950/30", border: "border-purple-200 dark:border-purple-800", badge: "bg-purple-100 text-purple-600 dark:bg-purple-600/20 dark:text-purple-400" },
  { key: "converted", label: "Convertidos", color: "bg-green-500", bg: "bg-green-50 dark:bg-green-950/30", border: "border-green-200 dark:border-green-800", badge: "bg-green-100 text-green-600 dark:bg-green-600/20 dark:text-green-400" },
  { key: "lost", label: "Perdidos", color: "bg-red-500", bg: "bg-red-50 dark:bg-red-950/30", border: "border-red-200 dark:border-red-800", badge: "bg-red-100 text-red-600 dark:bg-red-600/20 dark:text-red-400" },
];

const priorityLabels: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  normal: "Normal",
  low: "Baixa",
};

const priorityBorder: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-yellow-500",
  normal: "border-l-blue-500",
  low: "border-l-gray-400",
};

const sourceLabels: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  site: "Site",
  linkedin: "LinkedIn",
  indicacao: "Indicação",
};

export default function CrmKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const supabase = createClient();

  useEffect(() => {
    const fetchLeads = async () => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      setLeads(data || []);
    };
    fetchLeads();
  }, []);

  const leadsByStatus = columns.reduce(
    (acc, col) => {
      acc[col.key] = leads.filter((l) => l.status === col.key);
      return acc;
    },
    {} as Record<string, Lead[]>
  );

  const totalLeads = leads.length;

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">CRM Leads</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {totalLeads} lead{totalLeads !== 1 ? "s" : ""} no pipeline
          </p>
        </div>
      </div>

      <div className="flex-1 flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colLeads = leadsByStatus[col.key] || [];
          return (
            <div
              key={col.key}
              className={`flex-1 min-w-[280px] max-w-[360px] rounded-xl ${col.bg} border ${col.border} flex flex-col`}
            >
              <div className={`px-4 py-3 flex items-center justify-between rounded-t-xl ${col.bg}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
                    {col.label}
                  </h3>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${col.badge}`}>
                  {colLeads.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {colLeads.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-gray-400 dark:text-gray-500 text-xs">
                    Nenhum lead
                  </div>
                ) : (
                  colLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-3 hover:shadow-md transition cursor-pointer border-l-4 ${priorityBorder[lead.priority] || "border-l-gray-400"}`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Avatar name={lead.name} size="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {lead.name}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                            {lead.phone}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                          {sourceLabels[lead.source] || lead.source}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                          {priorityLabels[lead.priority] || lead.priority}
                        </span>
                      </div>

                      {lead.email && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 truncate">
                          {lead.email}
                        </p>
                      )}

                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                        {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
