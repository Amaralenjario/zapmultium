// Audio conversion Edge Function
// Receives audio URL → Transloadit → OGG Opus → upload Supabase Storage → returns OGG URL

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TRANSLOADIT_KEY = Deno.env.get("TRANSLOADIT_AUTH_KEY") || "";
const TRANSLOADIT_SECRET = Deno.env.get("TRANSLOADIT_AUTH_SECRET") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  try {
    const { fileUrl, phoneId } = await req.json();
    if (!fileUrl) return new Response(JSON.stringify({ error: "fileUrl required" }), { status: 400 });

    if (!TRANSLOADIT_KEY || !TRANSLOADIT_SECRET) {
      return new Response(JSON.stringify({ originalUrl: fileUrl, note: "no transloadit creds" }), { status: 200 });
    }

    // Already OGG?
    const isOgg = fileUrl.includes(".ogg") || fileUrl.includes(".opus");
    if (isOgg) {
      return new Response(JSON.stringify({ originalUrl: fileUrl, oggUrl: fileUrl, converted: false }), { status: 200 });
    }

    // Transloadit convert
    const auth = btoa(`${TRANSLOADIT_KEY}:${TRANSLOADIT_SECRET}`);
    const res = await fetch("https://api2.transloadit.com/assemblies", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        params: {
          steps: {
            encode: { robot: "/audio/encode", use: ":original", preset: "opus", ffmpeg_stack: "v6.0.0", ffmpeg: { ac: 1, ar: 32000, b: "32k" } },
          },
        },
        files: [{ url: fileUrl }],
      }),
    });

    const data = await res.json();
    if (!data.assembly_id) throw new Error("assembly creation failed");

    // Poll
    let oggUrl: string | null = null;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const poll = await fetch(`https://api2.transloadit.com/assemblies/${data.assembly_id}`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const p = await poll.json();
      if (p.ok === "COMPLETED") {
        oggUrl = p.results?.encode?.[0]?.ssl_url || p.results?.encode?.[0]?.url || null;
        break;
      }
      if (p.ok === "ABORTED" || p.ok === "FAILED") break;
    }

    if (!oggUrl) throw new Error("conversion failed or timed out");

    // Download OGG and upload to Supabase Storage
    const dl = await fetch(oggUrl);
    if (!dl.ok) throw new Error("download ogg failed");
    const oggBuf = await dl.arrayBuffer();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

    // Convert original filename to OGG version
    const originalName = fileUrl.split("/").pop()?.split("?")[0] || "audio";
    const baseName = originalName.split(".").slice(0, -1).join(".") || originalName;
    const oggName = `${baseName}.ogg`;

    // Upload OGG with original name so flow pipeline can find it
    const { error: uploadErr } = await supabase.storage.from("flow-media").upload(oggName, oggBuf, {
      contentType: "audio/ogg", upsert: true, cacheControl: "3600",
    });
    if (uploadErr) throw new Error(uploadErr.message);

    const { data: publicUrl } = supabase.storage.from("flow-media").getPublicUrl(fileName);

    return new Response(JSON.stringify({ originalUrl: fileUrl, oggUrl: publicUrl.publicUrl, converted: true }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message, originalUrl: null }), { status: 200 });
  }
});
