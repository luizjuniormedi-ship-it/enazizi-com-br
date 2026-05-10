const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

export async function createEmbedding(input: string): Promise<number[]> {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: input.replace(/\n/g, ' '),
      model: "text-embedding-3-small",
    }),
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Embedding failed (${res.status}): ${text}`);
  }
  
  const json = await res.json();
  return json.data[0].embedding;
}
