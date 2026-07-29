import Link from "next/link";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-500">ZapMultium</h1>
          <p className="mt-2 text-gray-400">Sistema de Atendimento WhatsApp</p>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8">
          <h2 className="text-xl font-semibold mb-6">Entrar</h2>
          <LoginForm />
          <p className="mt-4 text-center text-sm text-gray-400">
            Não tem conta?{" "}
            <Link href="/register" className="text-green-500 hover:text-green-400 font-medium">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
