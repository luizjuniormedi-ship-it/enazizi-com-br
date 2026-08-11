import { resolveTopicGranularity } from "../topic-fidelity/topic-resolver.ts";

/**
 * TUTOR MEDICAL ONTOLOGY — ENAZIZI P0 LOCK
 * 
 * Centraliza a resolução de siglas e termos ambíguos para o domínio médico.
 * O objetivo é garantir que "IAM" no ENAZIZI seja SEMPRE "Infarto Agudo do Miocárdio"
 * e nunca "AWS IAM", independentemente do conhecimento geral do LLM.
 */

export interface MedicalResolution {
  canonical: string;
  specialty: string;
  aliases: string[];
  priority: number;
}

const MEDICAL_REGISTRY: Record<string, MedicalResolution> = {
  "iam": {
    canonical: "Infarto Agudo do Miocárdio",
    specialty: "Cardiologia",
    aliases: ["iam", "infarto", "stemi", "nstemi", "infarto do miocárdio", "iamcsst", "iamssst"],
    priority: 10,
  },
  "sca": {
    canonical: "Síndrome Coronariana Aguda",
    specialty: "Cardiologia",
    aliases: ["sca", "síndrome coronariana", "angina instável"],
    priority: 10,
  },
  "tep": {
    canonical: "Tromboembolismo Pulmonar",
    specialty: "Pneumologia",
    aliases: ["tep", "embolia pulmonar"],
    priority: 10,
  },
  "ic": {
    canonical: "Insuficiência Cardíaca",
    specialty: "Cardiologia",
    aliases: ["ic", "icfer", "icfep", "insuficiência cardíaca congestiva", "icc"],
    priority: 10,
  },
  "has": {
    canonical: "Hipertensão Arterial Sistêmica",
    specialty: "Cardiologia",
    aliases: ["has", "hipertensão", "pressão alta"],
    priority: 10,
  },
  "dpoc": {
    canonical: "Doença Pulmonar Obstrutiva Crônica",
    specialty: "Pneumologia",
    aliases: ["dpoc", "enfisema", "bronquite crônica"],
    priority: 10,
  },
  "avc": {
    canonical: "Acidente Vascular Cerebral",
    specialty: "Neurologia",
    aliases: ["avc", "ave", "acidente vascular encefálico", "derrame"],
    priority: 10,
  },
  "ave": {
    canonical: "Acidente Vascular Encefálico",
    specialty: "Neurologia",
    aliases: ["ave", "avc", "derrame"],
    priority: 10,
  },
  "cad": {
    canonical: "Cetoacidose Diabética",
    specialty: "Endocrinologia",
    aliases: ["cad", "diabetic ketoacidosis"],
    priority: 10,
  },
  "ira": {
    canonical: "Insuficiência Renal Aguda",
    specialty: "Nefrologia",
    aliases: ["ira", "lra", "lesão renal aguda", "injúria renal aguda"],
    priority: 10,
  },
  "sepse": {
    canonical: "Sepse",
    specialty: "Infectologia",
    aliases: ["sepse", "sepsis", "choque séptico"],
    priority: 10,
  }
};

/**
 * Resolve um termo ambíguo para a ontologia médica do ENAZIZI.
 */
export function resolveMedicalDomain(input: string): { 
  canonical: string | null; 
  specialty: string | null;
  confidence: number;
  isMedical: boolean;
} {
  const normalized = input.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // remove acentos
  
  // 1. Check explicit non-medical intent (Anti-AWS Guard)
  if (normalized.includes("aws") || normalized.includes("amazon") || normalized.includes("cloud")) {
    return { canonical: null, specialty: null, confidence: 1.0, isMedical: false };
  }

  // 2. Check registry
  for (const [key, entry] of Object.entries(MEDICAL_REGISTRY)) {
    if (entry.aliases.includes(normalized) || normalized === key) {
      console.log(`[MEDICAL_DOMAIN_LOCK] Resolved "${input}" to "${entry.canonical}"`);
      return { 
        canonical: entry.canonical, 
        specialty: entry.specialty, 
        confidence: 0.99, 
        isMedical: true 
      };
    }
  }

  // 3. Fallback to topic-fidelity resolver
  const fidelity = resolveTopicGranularity(input);
  if (fidelity.isGranular && fidelity.topic) {
    return { 
      canonical: fidelity.topic, 
      specialty: fidelity.specialty, 
      confidence: fidelity.confidence, 
      isMedical: true 
    };
  }

  return { canonical: null, specialty: null, confidence: 0, isMedical: false };
}
