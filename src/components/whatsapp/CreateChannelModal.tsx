"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface CreatedChannel {
  id: string;
  name: string;
  token: string;
  status: string;
  type: string;
  connectUrl: string;
}

export default function CreateChannelModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<CreatedChannel | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const res = await fetch("/api/evohub/create-channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : (data.error?.message || JSON.stringify(data.error) || "Erro ao criar conexão");
        toast.error(msg);
        setLoading(false);
        return;
      }

      setChannel(data);
      setLoading(false);
      onCreated();
    } catch {
      toast.error("Erro de conexão com o servidor");
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    toast.success("Copiado!");
    setTimeout(() => setCopied(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCreate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl">
        {channel ? (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Conexão criada!</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-green-50 dark:bg-green-600/10 border border-green-200 dark:border-green-600/30 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-sm font-medium text-green-700 dark:text-green-400">{channel.name}</span>
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mb-3">
                Compartilhe o link abaixo com o cliente para conectar o WhatsApp dele.
              </p>

              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-600 dark:text-gray-300 truncate border border-gray-200 dark:border-gray-700">
                  {channel.connectUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(channel.connectUrl, "url")}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition flex-shrink-0 ${
                    copied === "url"
                      ? "bg-green-500 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {copied === "url" ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>

            <a
              href={channel.connectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition"
            >
              Abrir link de conexão
            </a>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nova conexão WhatsApp</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Crie um canal para conectar um número de WhatsApp Business. Após criar, compartilhe o link com o cliente para ele autorizar a conexão.
            </p>

            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Nome da conexão
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Atendimento Principal"
              autoFocus
              className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none transition"
            />

            <div className="flex gap-3 mt-5">
              <button
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || loading}
                className="flex-1 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? "Criando..." : "Criar conexão"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
