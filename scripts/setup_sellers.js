require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error("Defina SUPABASE_ACCESS_TOKEN"); process.exit(1); }
const URL = "https://api.supabase.com/v1/projects/ryurgbutqcgmicqqvols/database/query";

async function exec(sql) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const d = await r.json();
  if (r.status !== 200 && r.status !== 201) {
    console.log("  ERRO:", JSON.stringify(d).substring(0, 200));
  }
  return d;
}

async function main() {
  console.log("=== POPULANDO VENDEDORES ===\n");

  // Limpar dados antigos
  await exec("DELETE FROM public.vendedores");
  await exec("DELETE FROM public.seller_channels");

  // Pegar canais do EvoHub pra associar
  const res = await fetch("https://api.evohub.ai/api/v1/channels", {
    headers: { Authorization: `Bearer ${process.env.EVOHUB_API_KEY}` },
  });
  const { channels } = await res.json();
  console.log(`Canais EvoHub: ${channels?.length || 0}`);

  // Mapear vendedores -> canais
  const map = [
    { nome: "Ricardo Amaral", email: "amaral.ricardo.ig@gmail.com", user_id: "d010ff24-f00e-4758-afe4-dee03e20f0fd", channels: ["VH - 1692"] },
    { nome: "Gabriela Santos", email: "gabi@zapmultium.com", channels: ["GABI - 8176"] },
    { nome: "Gustavo Luis", email: "gustavo@zapmultium.com", channels: ["GUSTAVO - LUIS"] },
    { nome: "Amanda Jéssica", email: "amanda@zapmultium.com", channels: ["AMANDA - JÉ"] },
    { nome: "Caio Nunes", email: "caio@zapmultium.com", channels: ["NC - CAIO"] },
  ];

  for (const seller of map) {
    // Inserir vendedor
    console.log(`\n${seller.nome}:`);
    const match = channels?.find((c) => seller.channels.includes(c.name));
    const inst = match ? match.name : seller.channels[0];

    await exec(`
      INSERT INTO public.vendedores (nome, instancia_evolution)
      VALUES ('${seller.nome}', '${inst}')
      ON CONFLICT DO NOTHING
    `);
    console.log(`  instancia: ${inst}`);

    // Se tem user_id, associar canal via seller_channels
    if (seller.user_id && match) {
      await exec(`
        INSERT INTO public.seller_channels (user_id, evohub_channel_id, evohub_channel_name)
        VALUES ('${seller.user_id}', '${match.id}', '${match.name}')
        ON CONFLICT DO NOTHING
      `);
      console.log(`  canal: ${match.id.substring(0, 8)}... (${match.name})`);
    }
  }

  console.log("\n=== PRONTO ===");
}

main().catch(console.error);
