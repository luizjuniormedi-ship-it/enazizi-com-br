
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing environment variables");
  process.exit(1);
}

const body = {
  text: "O infarto agudo do miocárdio (IAM) é uma das principais causas de mortalidade no mundo. Paciente masculino, 55 anos, diabético e hipertenso, chega ao pronto-socorro com dor retroesternal em aperto há 2 horas, irradiada para membro superior esquerdo. O ECG mostra supra de segmento ST em derivações V1 a V4. A conduta imediata envolve terapia antiplaquetária dupla e reperfusão coronariana. Questão 1: Qual o diagnóstico mais provável? A) Angina estável B) IAM com supra de ST C) Pericardite D) TEP. Gabarito: B.",
  source: "TEST_IAM_DIRECT",
  topic: "Cardiologia"
};

const resp = await fetch(`${SUPABASE_URL}/functions/v1/populate-questions`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
  },
  body: JSON.stringify(body)
});

console.log("Status:", resp.status);
const data = await resp.json();
console.log("Data:", JSON.stringify(data, null, 2));
