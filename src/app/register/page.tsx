import Link from "next/link";
import { MessageCircle } from "lucide-react";
import RegisterForm from "@/components/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-bg">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center shadow-glow mb-4">
            <MessageCircle className="w-7 h-7 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-[-0.03em] text-tx">ZapMultium</h1>
          <p className="mt-1.5 text-sm text-tx2">Sistema de Atendimento WhatsApp</p>
        </div>

        <div className="rounded-card border border-bd bg-surface p-8 shadow-pop">
          <h2 className="text-xl font-bold tracking-[-0.02em] text-tx mb-6">Criar conta</h2>
          <RegisterForm />
          <p className="mt-6 text-center text-sm text-tx2">
            Já tem conta?{" "}
            <Link href="/login" className="text-accent hover:text-accent2 font-bold transition-colors">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
