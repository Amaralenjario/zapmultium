require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const EVOHUB_API_KEY = process.env.EVOHUB_API_KEY;
const EVOHUB_API_URL = process.env.EVOHUB_API_URL || "https://api.evohub.ai";
const WEBHOOK_SECRET = process.env.EVOHUB_WEBHOOK_SECRET || "zapmultium-webhook-secret";

// Altere para a URL real do deploy
const WEBHOOK_URL = process.argv[2] || "https://zapmultium.vercel.app/api/webhook/evohub";

async function createWebhook() {
  console.log("=== CRIANDO WEBHOOK EVOHUB ===\n");
  console.log("URL:", WEBHOOK_URL);
  console.log("Secret:", WEBHOOK_SECRET);

  const res = await fetch(`${EVOHUB_API_URL}/api/v1/webhooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${EVOHUB_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "ZapMultium - Recebimento de mensagens",
      url: WEBHOOK_URL,
      events: [
        "event_received",
        "webhook_delivered",
        "webhook_failed",
        "channel_connected",
        "channel_disconnected",
      ],
      secret: WEBHOOK_SECRET,
      channel_types: ["whatsapp"],
      all_channels: true,
    }),
  });

  const data = await res.json();
  console.log("Status:", res.status);
  console.log("Resposta:", JSON.stringify(data, null, 2));

  if (res.ok) {
    console.log("\nWebhook criado com sucesso!");
    console.log("ID:", data.id || data.webhook?.id);
  } else {
    console.log("\nErro ao criar webhook. Verifique a URL e API Key.");
  }
}

createWebhook().catch(console.error);
