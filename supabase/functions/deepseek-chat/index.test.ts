import "https://deno.land/std@0.224.0/dotenv/load.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

Deno.test("deepseek-chat basic call", async () => {
  console.log("URL:", SUPABASE_URL);
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/deepseek-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "Diga apenas: ok" }],
      boardContext: { titulo: "Teste", colunas: [], membros: [] },
    }),
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response (first 500 chars):", text.substring(0, 500));

  if (response.status !== 200) {
    throw new Error(`Failed with status ${response.status}: ${text}`);
  }
});
