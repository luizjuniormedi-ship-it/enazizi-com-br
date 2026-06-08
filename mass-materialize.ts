
import { createClient } from 'https://esm.sh/@supabase/supabase-client@2.39.3'

// Load from process.env if available, or use these names
const supabaseUrl = process.env.SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

console.log('Starting Mass Classification...')

async function run() {
  for (let i = 0; i < 5; i++) {
    console.log(`Processing Batch ${i + 1}...`)
    try {
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
    } catch (e) {
      console.error(`Exception in batch ${i + 1}:`, e)
    }
  }
  console.log('Mass Classification Finished.')
}

run()
