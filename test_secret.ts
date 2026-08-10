const key = Deno.env.get("CEREBRAS_API_KEY");
console.log(key ? "PRESENT" : "MISSING");
