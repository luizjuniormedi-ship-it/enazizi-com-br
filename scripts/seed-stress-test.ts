import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const patients = [
  // SALA VERMELHA
  { name: "Paciente 1", age: 62, gender: "M", main_complaint: "Dor precordial intensa com supra de ST", sector: "sala_vermelha", current_status: "critico", hidden_diagnosis: "IAM com supra" },
  { name: "Paciente 2", age: 45, gender: "F", main_complaint: "Febre, confusão mental e hipotensão", sector: "sala_vermelha", current_status: "critico", hidden_diagnosis: "Choque séptico" },
  { name: "Paciente 3", age: 70, gender: "M", main_complaint: "Déficit motor súbito à direita e afasia", sector: "sala_vermelha", current_status: "critico", hidden_diagnosis: "AVC isquêmico" },
  { name: "Paciente 4", age: 68, gender: "F", main_complaint: "Dispneia súbita e ortopneia (estertores em terço médio)", sector: "sala_vermelha", current_status: "critico", hidden_diagnosis: "Edema agudo de pulmão" },
  
  // SALA AMARELA
  { name: "Paciente 5", age: 55, gender: "M", main_complaint: "Tosse produtiva e febre alta (SpO2 88%)", sector: "sala_amarela", current_status: "grave", hidden_diagnosis: "Pneumonia grave" },
  { name: "Paciente 6", age: 24, gender: "F", main_complaint: "Hálito cetônico, vômitos e dor abdominal", sector: "sala_amarela", current_status: "grave", hidden_diagnosis: "Cetoacidose diabética" },
  { name: "Paciente 7", age: 38, gender: "F", main_complaint: "Febre, calafrios e dor lombar com sinal de Giordano +", sector: "sala_amarela", current_status: "grave", hidden_diagnosis: "Pielonefrite" },
  { name: "Paciente 8", age: 60, gender: "M", main_complaint: "Paciente renal crônico com fraqueza muscular", sector: "sala_amarela", current_status: "grave", hidden_diagnosis: "Hipercalemia" },

  // SALA VERDE
  { name: "Paciente 9", age: 32, gender: "M", main_complaint: "Lombalgia súbita sem sinais de alarme", sector: "sala_verde", current_status: "estavel", hidden_diagnosis: "Lombalgia" },
  { name: "Paciente 10", age: 28, gender: "F", main_complaint: "Cefaleia holocraniana pulsátil", sector: "sala_verde", current_status: "estavel", hidden_diagnosis: "Cefaleia" },
  { name: "Paciente 11", age: 19, gender: "M", main_complaint: "Diarreia e vômitos há 2 dias", sector: "sala_verde", current_status: "estavel", hidden_diagnosis: "Gastroenterite" },
  { name: "Paciente 12", age: 42, gender: "F", main_complaint: "Disúria e polaciúria", sector: "sala_verde", current_status: "estavel", hidden_diagnosis: "ITU simples" },
];

async function seed() {
  console.log("Seeding stress test patients...");
  const { error } = await supabase.from("hospital_patients").upsert(patients.map(p => ({
    ...p,
    vitals: { PA: "120/80", FC: "80", FR: "16", Temp: "36.5", SpO2: "98" },
    history_json: { history: "Início súbito dos sintomas..." },
    is_active: true
  })));
  
  if (error) console.error("Error seeding:", error);
  else console.log("Successfully seeded 12 patients.");
}

seed();
