import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function recoverTaxonomicBridge() {
  console.log('🚀 Starting P0 Taxonomic Bridge Recovery...');

  // 1. Critical Topics Mapping (Phase 9)
  const criticalMappings = [
    { legacy: 'ClinicaMedica_Cardiologia_Infarto', competency: 'IAM com Supra', aliases: ['IAM', 'IAMCSST', 'STEMI', 'Infarto', 'Infarto com Supra'] },
    { legacy: 'Infectologia_Sepse', competency: 'Sepse', aliases: ['Sepse', 'Choque Séptico', 'Sepse Grave'] },
    { legacy: 'Neurologia_AVC', competency: 'AVC', aliases: ['AVC', 'AVEi', 'AVEh', 'Stroke'] },
    { legacy: 'ClinicaMedica_Cardiologia_IC', competency: 'IC', aliases: ['IC', 'Insuficiência Cardíaca', 'ICC'] },
    { legacy: 'ClinicaMedica_Pneumologia_TEP', competency: 'TEP', aliases: ['TEP', 'Tromboembolismo Pulmonar', 'Embolia'] }
  ];

  for (const map of criticalMappings) {
    console.log(`Processing: ${map.competency}`);
    
    // Find competency ID
    const { data: comp } = await supabase
      .from('curriculum_registry')
      .select('id')
      .eq('name', map.competency)
      .single();

    if (comp) {
      // Register Aliases (Phase 3)
      for (const alias of map.aliases) {
        await supabase.from('competency_aliases').upsert({
          competency_id: comp.id,
          alias: alias,
          source: 'bridge_recovery'
        });
      }

      // Mass Reconciliation (Phase 5)
      const { count } = await supabase
        .from('questions_bank')
        .update({ 
          competency_id: comp.id,
          reconciliation_data: {
            source: 'P0_BRIDGE_RECOVERY',
            timestamp: new Date().toISOString(),
            confidence: 1.0
          }
        })
        .or(`topic.ilike.%${map.competency}%,subtopic.ilike.%${map.competency}%,topic.eq.${map.legacy}`);
      
      console.log(`✅ Linked ${count} questions to ${map.competency}`);
    }
  }

  // Final OCR Audit (Phase 10)
  const { data: ocr } = await supabase.rpc('calculate_ocr');
  console.log(`📊 Final Operational Coverage Rate (OCR): ${ocr}%`);
}

recoverTaxonomicBridge().catch(console.error);
