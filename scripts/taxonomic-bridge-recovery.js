const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function recoverTaxonomicBridge() {
  console.log('🚀 Starting P0 Taxonomic Bridge Recovery...');

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
    console.log('Processing: ' + map.target);
    
    const { data: comp } = await supabase
      .from('curriculum_registry')
      .select('id')
      .eq('curriculum_competency', map.target)
      .maybeSingle();

    if (comp) {
      console.log('Found ID: ' + comp.id);
      
      for (const alias of map.aliases) {
        await supabase.from('competency_aliases').upsert({
          competency_id: comp.id,
          alias: alias,
          source: 'bridge_recovery'
        });
      }

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
            confidence: 0.95,
            target: map.target
          }
        })
        .or(orFilter);
      
      if (error) {
        console.error('Error updating ' + map.target + ':', error);
      } else {
        console.log('✅ Linked ' + (count || 0) + ' questions to ' + map.target);
      }
    } else {
        console.warn('⚠️ Competency not found in registry: ' + map.target);
    }
  }

  const { data: ocrData, error: ocrError } = await supabase.rpc('calculate_ocr');
  if (ocrError) console.error('OCR Error:', ocrError);
  console.log('📊 Operational Coverage Rate (OCR): ' + (ocrData ? JSON.stringify(ocrData) : 'N/A') + '%');
}

recoverTaxonomicBridge().catch(console.error);
