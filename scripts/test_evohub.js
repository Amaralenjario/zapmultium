require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const API_KEY = process.env.EVOHUB_API_KEY;
const BASE = "https://api.evohub.ai";

async function main() {
  const res = await fetch(`${BASE}/api/v1/channels`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const data = await res.json();
  console.log("=== CANAIS EvoHub ===");
  console.log(`Total: ${data.channels?.length || 0}\n`);

  if (data.channels) {
    for (const ch of data.channels) {
      console.log(`--- ${ch.name} ---`);
      console.log(`  id:      ${ch.id}`);
      console.log(`  type:    ${ch.type}`);
      console.log(`  status:  ${ch.status}`);
      console.log(`  token:   ${ch.token?.substring(0,16)}...`);
      console.log(`  created: ${ch.created_at}`);
      if (ch.metadata?.meta_connection) {
        const mc = ch.metadata.meta_connection;
        console.log(`  phone:   ${mc.phone_number || "N/A"}`);
        console.log(`  waba_id: ${mc.waba_id || "N/A"}`);
        console.log(`  phone_id: ${mc.phone_number_id || "N/A"}`);
        console.log(`  display: ${mc.display_name || "N/A"}`);
      }
      console.log();
    }
  }
}

main().catch((e) => console.error(e.message));
