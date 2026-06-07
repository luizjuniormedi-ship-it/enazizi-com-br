const { createClient } = require('@supabase/supabase-js');

// Using standard environment variables injected by Lovable
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function recoverTaxonomicBridge() {
  console.log('🚀 Starting P0 Taxonomic Bridge Recovery...');

  const criticalMappings = [
    { legacy: 'ClinicaMedica_Cardiologia_Infarto', competency: 'IAM com Supra', aliases: ['IAM', 'IAMCSST', 'STEMI', 'Infarto', 'Infarto com Supra'] },
    { legacy: 'Infectologia_Sepse', competency: 'Sepse', aliases: ['Sepse', 'Choque Séptico', 'Sepse Grave'] },
    { legacy: 'Neurologia_AVC', competency: 'AVC', aliases: ['AVC', 'AVEi', 'AVEh', 'Stroke'] },
    { legacy: 'ClinicaMedica_Cardiologia_IC', competency: 'IC', aliases: ['IC', 'Insuficiência Cardíaca', 'ICC'] },
    { legacy: 'ClinicaMedica_Pneumologia_TEP', competency: 'TEP', aliases: ['TEP', 'Tromboembolismo Pulmonar', 'Embolia'] }
  ];

  for (const map of criticalMappings) {
    console.log('Processing: ' + map.competency);
    
    // Find competency ID using the correct column name
    const { data: comp } = await supabase
      .from('curriculum_registry')
      .select('id')
      .eq('curriculum_competency', map.competency)
      .maybeSingle();

    if (comp) {
      // Create aliases for fuzzy search discovery
      for (const alias of map.aliases) {
        await supabase.from('competency_aliases').upsert({
          competency_id: comp.id,
          alias: alias,
          source: 'bridge_recovery'
        });
      }

      // Link physical questions to the curriculum
      const { count, error } = await supabase
        .from('questions_bank')
        .update({ 
          competency_id: comp.id,
          reconciliation_data: {
            source: 'P0_BRIDGE_RECOVERY',
            timestamp: new Date().toISOString(),
            confidence: 1.0
          }
        })
        .or('topic.ilike.%' + map.competency + '%,subtopic.ilike.%' + map.competency + '%,topic.eq.' + map.legacy);
      
      if (error) {
        console.error('Error updating ' + map.competency + ':', error);
      } else {
        console.log('✅ Linked questions to ' + map.competency);
      }
    } else {
        console.warn('⚠️ Competency not found in registry: ' + map.competency);
    }
  }

  const { data: ocrData } = await supabase.rpc('calculate_ocr');
  console.log('📊 Operational Coverage Rate (OCR): ' + (ocrData ? ocrData : 'N/A') + '%');
}

recoverTaxonomicBridge().catch(console.error);
