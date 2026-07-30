import { listChannelsForUser } from "@/lib/evohub";
import WhatsappPageClient from "./WhatsappPageClient";

export default async function WhatsappsPage() {
  const channels = await listChannelsForUser();

  return <WhatsappPageClient initialChannels={channels} />;
}
