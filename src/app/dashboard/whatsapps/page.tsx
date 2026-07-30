import { listChannels } from "@/lib/evohub";
import WhatsappPageClient from "./WhatsappPageClient";

export default async function WhatsappsPage() {
  const channels = await listChannels();

  return <WhatsappPageClient initialChannels={channels} />;
}
