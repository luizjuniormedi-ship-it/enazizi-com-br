import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

export async function processDualClassification(questionId: string) {
  const { data: question } = await supabase
    .from('questions_bank')
    .select('*')
    .eq('id', questionId)
    .single();

  if (!question) return;

  // Mocking Dual Classifier behavior
  const classificationA = {
    competency_id: "78207907-7819-4a41-b964-6d9b35064c58", // Exemplo fixo para teste
    confidence: 0.98,
    theme: "IAM com Supra"
  };

  const classificationB = {
    competency_id: "78207907-7819-4a41-b964-6d9b35064c58",
    confidence: 0.95,
    theme: "Infarto Agudo do Miocárdio"
  };

  const isDivergent = classificationA.competency_id !== classificationB.competency_id;

  const { error } = await supabase.from('question_classification_staging').upsert({
    question_id: questionId,
    classification_a: classificationA,
    classification_b: classificationB,
    competency_id: classificationA.competency_id,
    audit_status: isDivergent ? 'flagged' : 'pending',
    confidence_score: Math.min(classificationA.confidence, classificationB.confidence)
  });

  if (error) console.error(`Error processing question ${questionId}:`, error.message);
}
