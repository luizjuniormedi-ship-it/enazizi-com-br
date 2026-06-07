const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function recoverTaxonomicBridge() {
  console.log('🚀 Starting P0 Taxonomic Bridge Recovery (ID-Based)...');

  const criticalMappings = [
    { 
      id: '4827198a-28a1-4386-a72c-ef8aad61e6a2',
      target: 'Síndrome Coronariana Aguda', 
      aliases: ['IAM', 'IAMCSST', 'IAMSSST', 'STEMI', 'Infarto', 'Infarto com Supra', 'SCA com Supra', 'SCA'],
      patterns: ['%Infarto%', '%Coronariana%', '%SCA%'],
      legacy: 'ClinicaMedica_Cardiologia_Infarto'
    },
    { 
      id: 'cc56109f-f627-496e-b3f8-cdf17f9e3f4d',
      target: 'Sepse', 
      aliases: ['Sepse', 'Choque Séptico', 'Sepse Grave', 'SIRS'],
      patterns: ['%Sepse%'],
      legacy: 'Infectologia_Sepse'
    },
    { 
      id: 'd4fdde7e-8389-4ecd-8fdf-69d4ca90a289',
      target: 'AVC', 
      aliases: ['AVC', 'AVEi', 'AVEh', 'Stroke', 'Acidente Vascular'],
      patterns: ['%AVC%', '%AVE%', '%Acidente Vascular%'],
      legacy: 'Neurologia_AVC'
    },
    { 
      id: 'd7444954-b4e6-4a37-9df6-b26262f09d35',
      target: 'Insuficiência Cardíaca', 
      aliases: ['IC', 'Insuficiência Cardíaca', 'ICC', 'ICFEP', 'ICFER'],
      patterns: ['%Insuficiência Cardíaca%', '%ICC%'],
      legacy: 'ClinicaMedica_Cardiologia_IC'
    },
    { 
      id: 'c0a1bf5e-d18c-407b-8210-47beb3618be7',
      target: 'TEP', 
      aliases: ['TEP', 'Tromboembolismo Pulmonar', 'Embolia', 'TVP'],
      patterns: ['%TEP%', '%Tromboembolismo%'],
      legacy: 'ClinicaMedica_Pneumologia_TEP'
    }
  ];

  for (const map of criticalMappings) {
    console.log('Processing: ' + map.target + ' (ID: ' + map.id + ')');
    
    // 1. Verify Competency Existence
    const { data: comp } = await supabase
      .from('curriculum_registry')
      .select('id')
      .eq('id', map.id)
      .maybeSingle();

    if (!comp) {
      console.warn('❌ Competency ID not found in database: ' + map.id);
      continue;
    }

    // 2. Upsert Aliases
    for (const alias of map.aliases) {
      await supabase.from('competency_aliases').upsert({
        competency_id: map.id,
        alias: alias,
        source: 'bridge_recovery'
      });
    }

    // 3. Update Questions
    let orFilter = 'topic.eq.' + map.legacy;
    for (const p of map.patterns) {
      orFilter += ',topic.ilike.' + p + ',subtopic.ilike.' + p;
    }

    const { count, error } = await supabase
      .from('questions_bank')
      .update({ 
        competency_id: map.id,
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
  }

  const { data: ocrData } = await supabase.rpc('calculate_ocr');
  console.log('📊 Final Operational Coverage Rate (OCR): ' + JSON.stringify(ocrData) + '%');
}

recoverTaxonomicBridge().catch(console.error);
