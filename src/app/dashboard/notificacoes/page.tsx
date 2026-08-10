import NotificationsManager from "@/components/pwa/NotificationsManager";

export default function NotificacoesPage() {
  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-extrabold tracking-[-0.03em] text-tx mb-1">Notificações</h1>
      <p className="text-sm text-tx3 mb-5">Receba um aviso na hora que um lead te mandar mensagem.</p>
      <NotificationsManager />
    </div>
  );
}
