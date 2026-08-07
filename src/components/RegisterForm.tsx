"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

const inputClass =
  "w-full rounded-control border border-bd bg-surface2 px-4 py-3 text-tx placeholder:text-tx3 focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none transition";

export default function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Conta criada! Verifique seu email para confirmar.");
    window.location.href = "/login";
  };

  return (
    <form onSubmit={handleRegister} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-sm font-semibold text-tx2 mb-1.5">
          Nome completo
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Seu nome"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-tx2 mb-1.5">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="seu@email.com"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-tx2 mb-1.5">
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          placeholder="Mínimo 6 caracteres"
          className={inputClass}
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-control bg-accent px-4 py-3 font-bold text-white shadow-glow hover:bg-accent2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Criando conta..." : "Criar conta"}
      </button>
    </form>
  );
}
