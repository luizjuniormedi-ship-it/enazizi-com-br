const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function recoverTaxonomicBridge() {
  console.log('🚀 Starting P0 Taxonomic Bridge Recovery (Direct Query Mode)...');

  // 1. First, get all competencies to avoid string matching issues
  const { data: registry, error: regError } = await supabase
    .from('curriculum_registry')
    .select('id, curriculum_competency');

  if (regError) {
    console.error('Failed to fetch registry:', regError);
    return;
  }

  console.log('Registry loaded: ' + registry.length + ' competencies.');

  const criticalMappings = [
    { 
      target: 'Síndrome Coronariana Aguda', 
      aliases: ['IAM', 'IAMCSST', 'IAMSSST', 'STEMI', 'Infarto', 'Infarto com Supra', 'SCA com Supra', 'SCA'],
      patterns: ['%Infarto%', '%Coronariana%', '%SCA%'],
      legacy: 'ClinicaMedica_Cardiologia_Infarto'
    },
    { 
      target: 'Sepse', 
      aliases: ['Sepse', 'Choque Séptico', 'Sepse Grave', 'SIRS'],
      patterns: ['%Sepse%'],
      legacy: 'Infectologia_Sepse'
    },
    { 
      target: 'AVC', 
      aliases: ['AVC', 'AVEi', 'AVEh', 'Stroke', 'Acidente Vascular'],
      patterns: ['%AVC%', '%AVE%', '%Acidente Vascular%'],
      legacy: 'Neurologia_AVC'
    },
    { 
      target: 'Insuficiência Cardíaca', 
      aliases: ['IC', 'Insuficiência Cardíaca', 'ICC', 'ICFEP', 'ICFER'],
      patterns: ['%Insuficiência Cardíaca%', '%ICC%'],
      legacy: 'ClinicaMedica_Cardiologia_IC'
    },
    { 
      target: 'TEP', 
      aliases: ['TEP', 'Tromboembolismo Pulmonar', 'Embolia', 'TVP'],
      patterns: ['%TEP%', '%Tromboembolismo%'],
      legacy: 'ClinicaMedica_Pneumologia_TEP'
    }
  ];

  for (const map of criticalMappings) {
    const comp = registry.find(r => r.curriculum_competency.trim() === map.target);

    if (comp) {
      console.log('Processing: ' + map.target + ' (ID: ' + comp.id + ')');
      
      // Upsert Aliases
      for (const alias of map.aliases) {
        await supabase.from('competency_aliases').upsert({
          competency_id: comp.id,
          alias: alias,
          source: 'bridge_recovery'
        });
      }

      // Bulk Link Questions
      let orFilter = 'topic.eq.' + map.legacy;
      for (const p of map.patterns) {
        orFilter += ',topic.ilike.' + p + ',subtopic.ilike.' + p;
      }

      const { count, error } = await supabase
        .from('questions_bank')
        .update({ 
          competency_id: comp.id,
          reconciliation_data: {
            source: 'P0_BRIDGE_RECOVERY',
            timestamp: new Date().toISOString(),
            confidence: 0.95
          }
        })
        .or(orFilter);
      
      if (error) {
        console.error('Error updating ' + map.target + ':', error);
      } else {
        console.log('✅ Linked ' + (count || 0) + ' questions to ' + map.target);
      }
    } else {
        console.warn('⚠️ Competency not found in registry (Exact Match Failed): ' + map.target);
    }
  }

  const { data: ocrData } = await supabase.rpc('calculate_ocr');
  console.log('📊 Operational Coverage Rate (OCR): ' + JSON.stringify(ocrData) + '%');
}

recoverTaxonomicBridge().catch(console.error);
