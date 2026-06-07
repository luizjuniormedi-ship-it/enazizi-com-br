const { createClient } = require('@supabase/supabase-js');

// Explicitly use the Service Role Key for writing if available, otherwise Anon
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
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
    console.log('Searching for target: ' + map.target);
    
    const { data: comp, error: compError } = await supabase
      .from('curriculum_registry')
      .select('id, curriculum_competency')
      .eq('curriculum_competency', map.target)
      .maybeSingle();

    if (compError) {
      console.error('Error finding competency:', compError);
      continue;
    }

    if (comp) {
      console.log('✅ Found Competency: ' + comp.curriculum_competency + ' (ID: ' + comp.id + ')');
      
      // Upsert Aliases
      for (const alias of map.aliases) {
        const { error: aliasError } = await supabase.from('competency_aliases').upsert({
          competency_id: comp.id,
          alias: alias,
          source: 'bridge_recovery'
        });
        if (aliasError) console.error('Alias Error:', aliasError);
      }

      // Link Questions
      let orFilter = 'topic.eq.' + map.legacy;
      for (const p of map.patterns) {
        orFilter += ',topic.ilike.' + p + ',subtopic.ilike.' + p;
      }

      const { count, error: updateError } = await supabase
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
      
      if (updateError) {
        console.error('Update Error:', updateError);
      } else {
        console.log('✅ Successfully linked ' + (count || 0) + ' questions to ' + map.target);
      }
    } else {
      console.warn('❌ COMPETENCY NOT FOUND: ' + map.target);
    }
  }

  const { data: ocrData } = await supabase.rpc('calculate_ocr');
  console.log('📊 Operational Coverage Rate (OCR): ' + JSON.stringify(ocrData) + '%');
}

recoverTaxonomicBridge().catch(console.error);
