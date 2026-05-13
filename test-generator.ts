import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function testGenerator() {
  console.log("Testing question-generator...");
  
  const payload = {
    stream: false,
    outputFormat: "json",
    difficulty: "misto",
    messages: [{
      role: "user",
      content: "Gere 2 questões de Cardiologia."
    }],
    generationContext: {
      specialty: "Cardiologia",
      topic: "Cardiologia",
      objective: "practice",
      source: "simulado"
    },
    count: 2
  };

  try {
    // Note: invoke uses headers for service role
    const { data, error } = await supabase.functions.invoke("question-generator", {
      body: payload
    });

    if (error) {
      console.error("Function error:", error);
      return;
    }

    console.log("Response success:", data.success);
    if (data && data.questions) {
      console.log(`Generated ${data.questions.length} questions`);
      data.questions.forEach((q: any, i: number) => {
        console.log(`\nQ${i+1}: ${q.statement?.slice(0, 100)}...`);
        console.log(`Options: ${q.options?.length}`);
        console.log(`Correct: ${q.correct_index}`);
      });
    } else {
      console.log("No questions returned in data:", data);
    }
  } catch (e) {
    console.error("Execution error:", e);
  }
}

testGenerator();
