require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

function randomDate(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - Math.random() * daysBack);
  d.setHours(8 + Math.floor(Math.random() * 14), Math.floor(Math.random() * 60));
  return d.toISOString();
}

async function main() {
  console.log("=== CRIANDO DADOS DE TESTE ===\n");

  // 1. Customers
  console.log("1. Criando contatos...");
  const customers = [
    { name: "Maria Silva", phone: "+5511999990001", email: "maria@email.com", tags: ["cliente", "vip"], notes: "Cliente desde 2024. Prefere atendimento rápido." },
    { name: "João Santos", phone: "+5511999990002", email: "joao@email.com", tags: ["lead"], notes: "Interessado no plano premium." },
    { name: "Ana Costa", phone: "+5511999990003", email: "ana@email.com", tags: ["cliente"], notes: "Dúvidas sobre integração com API." },
    { name: "Pedro Alves", phone: "+5511999990004", email: "pedro@email.com", tags: ["lead", "urgente"], notes: "Quer migrar da concorrência." },
    { name: "Carla Mendes", phone: "+5511999990005", email: "carla@email.com", tags: ["cliente", "vip"], notes: "Representante de agência, múltiplos usuários." },
    { name: "Lucas Ferreira", phone: "+5511999990006", email: "lucas@email.com", tags: ["lead"], notes: "Veio pelo Instagram." },
    { name: "Juliana Rocha", phone: "+5511999990007", email: "juliana@email.com", tags: ["cliente"], notes: "Problemas com upload de mídia." },
    { name: "Rafael Torres", phone: "+5511999990008", email: "rafael@email.com", tags: ["lead"], notes: "Empresa de médio porte." },
  ];

  const createdCustomers = [];
  for (const c of customers) {
    const { data, error } = await supabase.from("customers").upsert(c, { onConflict: "phone" }).select("id").single();
    if (error) {
      console.log("  ERRO:", c.name, error.message);
    } else {
      console.log("  OK:", c.name);
      createdCustomers.push({ ...c, id: data.id });
    }
  }

  // 2. Conversations
  console.log("\n2. Criando conversas...");
  const conversations = [
    { customer_id: createdCustomers[0].id, status: "active", source: "whatsapp" },
    { customer_id: createdCustomers[1].id, status: "active", source: "whatsapp" },
    { customer_id: createdCustomers[2].id, status: "pending", source: "whatsapp" },
    { customer_id: createdCustomers[3].id, status: "active", source: "whatsapp" },
    { customer_id: createdCustomers[4].id, status: "closed", source: "whatsapp" },
    { customer_id: createdCustomers[5].id, status: "active", source: "whatsapp" },
    { customer_id: createdCustomers[6].id, status: "pending", source: "whatsapp" },
    { customer_id: createdCustomers[7].id, status: "active", source: "whatsapp" },
  ];

  const createdConvs = [];
  for (const c of conversations) {
    const { data, error } = await supabase.from("conversations").insert(c).select("id").single();
    if (error) {
      console.log("  ERRO:", error.message);
    } else {
      createdConvs.push(data.id);
    }
  }

  // 3. Messages
  console.log("\n3. Criando mensagens...");

  const messageScripts = {
    0: [
      { sender_type: "customer", content: "Olá! Gostaria de saber mais sobre os planos de vocês." },
      { sender_type: "agent", content: "Olá Maria! Claro, temos planos a partir de R$49/mês. Qual tipo de atendimento você precisa?" },
      { sender_type: "customer", content: "Preciso de algo para minha loja, com 3 atendentes." },
      { sender_type: "agent", content: "Perfeito! Nosso plano Professional atende até 5 usuários por R$149/mês. Inclui chatbot, CRM e relatórios." },
      { sender_type: "customer", content: "Interessante! Tem relatório de desempenho dos atendentes?" },
      { sender_type: "agent", content: "Sim! O dashboard mostra tempo médio de resposta, quantidade de atendimentos, satisfação do cliente e muito mais." },
      { sender_type: "customer", content: "Ótimo! Como faço pra contratar?" },
    ],
    1: [
      { sender_type: "customer", content: "Bom dia! Vi o anúncio de vocês no Instagram." },
      { sender_type: "agent", content: "Bom dia João! Que bom que veio. Qual é a sua necessidade?" },
      { sender_type: "customer", content: "Tenho um e-commerce e quero automatizar o atendimento pós-venda." },
      { sender_type: "agent", content: "Saquei! Temos fluxos prontos pra confirmação de pedido, rastreio e pesquisa de satisfação." },
      { sender_type: "customer", content: "E se eu quiser criar meus próprios fluxos?" },
      { sender_type: "agent", content: "Nosso construtor de fluxos é bem intuitivo, você monta arrastando blocos. E posso te ajudar na configuração inicial sem custo." },
    ],
    3: [
      { sender_type: "customer", content: "Estou usando o ConcorrenteX mas tá muito caro. Vocês fazem migração?" },
      { sender_type: "agent", content: "Fazemos sim Pedro! E temos uma oferta especial pra quem migra: 30% de desconto nos primeiros 6 meses." },
      { sender_type: "customer", content: "Caramba, isso é muito bom! Quanto tempo leva a migração?" },
      { sender_type: "agent", content: "Geralmente 24-48h dependendo do volume. Nossa equipe cuida de tudo, exportamos contatos, templates e fluxos." },
      { sender_type: "customer", content: "Perfeito. Me manda a proposta que eu fecho hoje." },
      { sender_type: "agent", content: "Enviando agora no seu email!" },
    ],
    5: [
      { sender_type: "customer", content: "Olá, quero um orçamento para 10 atendentes." },
      { sender_type: "agent", content: "Claro Lucas! Para esse volume recomendamos o plano Enterprise. Inclui API, white label e suporte prioritário." },
      { sender_type: "customer", content: "Tem white label mesmo? Posso colocar a logo da minha empresa?" },
    ],
    7: [
      { sender_type: "customer", content: "Meu whatsapp caiu, vocês dão suporte nisso?" },
      { sender_type: "agent", content: "Damos sim! Mas isso geralmente é resolvido direto com a Meta. Você já verificou o Gerenciador de Negócios?" },
      { sender_type: "customer", content: "Não sei mexer nisso..." },
      { sender_type: "agent", content: "Sem problema! Posso te guiar no passo a passo agora: vai em business.facebook.com, faz login e me diz o que aparece." },
      { sender_type: "customer", content: "Apareceu 'Número não verificado'." },
      { sender_type: "agent", content: "Perfeito! Clica em Configurações > Números de telefone > Verificar. Vai chegar um SMS, confirma que libera em 5 min." },
    ],
  };

  let messageCount = 0;
  for (const [idx, msgs] of Object.entries(messageScripts)) {
    const convId = createdConvs[parseInt(idx)];
    if (!convId) continue;
    let baseTime = new Date();
    baseTime.setHours(baseTime.getHours() - msgs.length);

    for (const msg of msgs) {
      baseTime = new Date(baseTime.getTime() + 60000 * (1 + Math.random() * 3));
      const { error } = await supabase.from("messages").insert({
        conversation_id: convId,
        content: msg.content,
        sender_type: msg.sender_type,
        content_type: "text",
        created_at: baseTime.toISOString(),
      });
      if (!error) messageCount++;
    }

    // Update last_message
    const lastMsg = msgs[msgs.length - 1];
    await supabase.from("conversations").update({
      last_message: lastMsg.content,
      last_message_at: baseTime.toISOString(),
      unread_count: Math.floor(Math.random() * 3),
    }).eq("id", convId);
  }

  console.log("  " + messageCount + " mensagens inseridas");

  // 4. Leads
  console.log("\n4. Criando leads...");
  const leads = [
    { name: "Roberto Nunes", phone: "+5511988880001", source: "whatsapp", status: "new", funnel_stage: "captura", priority: "high" },
    { name: "Fernanda Lima", phone: "+5511988880002", source: "instagram", status: "contacted", funnel_stage: "qualificacao", priority: "normal" },
    { name: "Bruno Cardoso", phone: "+5511988880003", source: "whatsapp", status: "qualified", funnel_stage: "proposta", priority: "urgent" },
    { name: "Patricia Souza", phone: "+5511988880004", source: "site", status: "converted", funnel_stage: "fechamento", priority: "high" },
    { name: "Daniel Oliveira", phone: "+5511988880005", source: "whatsapp", status: "lost", funnel_stage: "acompanhamento", priority: "low" },
    { name: "Camila Dias", phone: "+5511988880006", source: "indicacao", status: "new", funnel_stage: "captura", priority: "normal" },
    { name: "Thiago Martins", phone: "+5511988880007", source: "whatsapp", status: "contacted", funnel_stage: "qualificacao", priority: "high" },
    { name: "Amanda Vieira", phone: "+5511988880008", source: "linkedin", status: "qualified", funnel_stage: "proposta", priority: "normal" },
  ];

  for (const l of leads) {
    const { error } = await supabase.from("leads").insert({
      ...l,
      created_at: randomDate(30),
    });
    if (!error) console.log("  OK:", l.name);
  }

  // 5. Flows
  console.log("\n5. Criando fluxos...");
  const flows = [
    { name: "Boas-vindas", description: "Mensagem automática para novos contatos", trigger_type: "first_message", status: "active", config: { steps: [{ action: "send_message", text: "Olá! Bem-vindo à ZapMultium. Como posso ajudar?" }, { action: "show_menu", options: ["Suporte", "Vendas", "Financeiro"] }] } },
    { name: "Pesquisa de satisfação", description: "Enviada 24h após fechamento do ticket", trigger_type: "schedule", status: "active", config: { steps: [{ action: "send_message", text: "Como foi seu atendimento? Responda de 1 a 5." }, { action: "capture_rating" }] } },
    { name: "Confirmação de pedido", description: "Disparado após integração com e-commerce", trigger_type: "webhook", status: "draft", config: { steps: [{ action: "send_template", template: "pedido_confirmado" }, { action: "send_tracking", delay: 7200 }] } },
    { name: "Palavra-chave: Orçamento", description: "Ativado quando cliente digita 'orcamento' ou 'preço'", trigger_type: "keyword", trigger_value: "orcamento,preço,preco,valor,valores", status: "active", config: { steps: [{ action: "send_message", text: "Claro! Para enviarmos um orçamento, preciso de algumas informações." }, { action: "capture", fields: ["nome", "empresa", "qtd_atendentes"] }] } },
    { name: "Reativação de inativos", description: "Contata clientes sem interação há 30 dias", trigger_type: "schedule", status: "inactive", config: { steps: [{ action: "send_message", text: "Oi! Sentimos sua falta. Temos novidades pra você." }, { action: "show_promotion" }] } },
  ];

  for (const f of flows) {
    const { error } = await supabase.from("flows").insert(f);
    if (!error) console.log("  OK:", f.name);
  }

  console.log("\n=== TUDO PRONTO! ===");
  console.log(customers.length + " contatos");
  console.log(createdConvs.length + " conversas");
  console.log(messageCount + " mensagens");
  console.log(leads.length + " leads");
  console.log(flows.length + " fluxos");
}

main().catch((e) => console.error(e.message));
