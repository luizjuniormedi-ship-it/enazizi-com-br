import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { getServiceClient } from "../_shared/pipeline-logger.ts"
import { validateAIOutput } from "../_shared/ai-validation.ts"
import { aiFetch } from "../_shared/ai-fetch.ts"
import { sanitizeForPostgres } from "../_shared/db-utils.ts"

// Constants exactly as they were in the broken version
const TRUSTED_DOMAINS = [
  "inep.gov.br", "gov.br", "saude.sp.gov.br", "saude.gov.br",
  "enare.org.br", "abmes.org.br",
  "usp.br", "unicamp.br", "unifesp.br", "fmusp.br", "fcm.unicamp.br",
  "ufpr.br", "ufrj.br", "ufmg.br", "ufrgs.br", "ufba.br", "ufpe.br",
  "ufsc.br", "unesp.br", "uel.br", "uem.br", "ufg.br", "ufms.br",
  "ufpa.br", "ufma.br", "ufrn.br", "ufal.br", "ufes.br", "ufc.br",
  "ufpb.br", "ufpi.br", "ufmt.br", "unb.br", "ufam.br",
  "ufscar.br", "ufsm.br", "furg.br", "ufla.br",
  "pucrs.br", "pucsp.br", "pucminas.br", "pucpr.br",
  "mackenzie.br", "einstein.br", "hsl.org.br",
  "santacasasp.org.br", "fcmsantacasasp.edu.br",
  "fgv.br", "vunesp.com.br", "cesgranrio.org.br", "ibfc.org.br",
  "amrigs.org.br", "upenet.com.br", "fuvest.br", "comvest.unicamp.br",
  "famerp.br", "fmabc.br", "iamspe.sp.gov.br",
  "qconcursos.com.br", "pciconcursos.com.br", "questoesmedicas.com.br",
  "residenciamedicasp.com.br", "residenciamedica.com.br",
  "provamedicina.com.br", "residenciamedica.net",
  "medway.com.br", "medcel.com.br", "estrategiamed.com.br",
  "medgrupo.com.br", "sanarmed.com", "editorasanar.com.br",
  "jaleko.com.br", "afya.com.br", "med.estrategia.com",
];

const ENGLISH_PATTERN = /\b(the patient|which of the following|a \d+-year-old|presents with|physical examination|most likely|treatment of choice|year-old male|year-old female|upon examination|medical history)\b/i;

const CLINICAL_MARKERS = [
  /\b\d{1,3}\s*(anos?|meses?|dias?)\b/i,
  /\b(masculino|feminino|homem|mulher|paciente|gestante|idoso|criança|lactente)\b/i,
  /\b(PA|FC|FR|SpO2|temperatura|pressão arterial|frequência cardíaca)\b/i,
  /\b(exame físico|ao exame|ausculta|palpação|inspeção|percussão)\b/i,
  /\b(hemograma|glicemia|creatinina|ureia|PCR|VHS|TSH|ECG|tomografia|radiografia)\b/i,
  /\b(queixa|refere|relata|apresenta|evolui|procura|admitido|internado)\b/i,
];

const OPTION_PATTERN = /^[A-E]\)\s/;
const QUESTION_MARKER = /(?:[A-E]\)\s|alternativa|gabarito|\bquestão\b|\d+\.\s)/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { specialty, banca } = await req.json().catch(() => ({}));
    
    if (!specialty) {
       return new Response(JSON.stringify({ 
         success: true, 
         stage: "BOOT_OK",
         message: "Send POST with specialty to run full logic" 
       }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({
      success: true,
      function: "search-real-questions",
      stage: "FULL_RECONSTRUCTION_BOOT_OK",
      timestamp: new Date().toISOString()
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      function: "search-real-questions",
      stage: "CATCH_ALL",
      error: String(err),
      stack: err instanceof Error ? err.stack : null
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })
  }
})
