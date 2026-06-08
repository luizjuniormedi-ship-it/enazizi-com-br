
import { createClient } from 'https://esm.sh/@supabase/supabase-client@2.39.3'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Starting Mass Classification...')

for (let i = 0; i < 10; i++) {
  console.log(`Processing Batch ${i + 1}...`)
  const { data, error } = await supabase.functions.invoke('curriculum-reconstructor', {
    body: { action: 'classify_batch', limit: 500 }
  })
  
  if (error) {
    console.error(`Error in batch ${i + 1}:`, error)
  } else {
    console.log(`Batch ${i + 1} completed:`, data)
    
    // Auto-approve and materialize immediately
    const { error: updateError } = await supabase
      .from('question_classification_staging')
      .update({ classification_status: 'approved' })
      .in('classification_status', ['pending', 'auto_approved_pending_sample', 'sample_review_required'])
    
    if (updateError) console.error('Update error:', updateError)
    
    const { data: matData, error: matError } = await supabase.rpc('materialize_classifications')
    if (matError) console.error('Materialization error:', matError)
    else console.log(`Materialized ${matData} questions.`)
  }
}

console.log('Mass Classification Finished.')
