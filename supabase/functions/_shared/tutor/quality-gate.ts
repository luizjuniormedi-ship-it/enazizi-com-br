export function validateTutorOutput(content: string, topic: string): { isValid: boolean; reason?: string } {
  const normalizedContent = content.toLowerCase();
  const normalizedTopic = topic.toLowerCase();
  
  // 1. Generic Assistant Block
  if (normalizedContent.includes("how can i help you today") || 
      normalizedContent.includes("como posso te ajudar") ||
      normalizedContent.length < 50) {
    return { isValid: false, reason: "GENERIC_ASSISTANT_RESPONSE" };
  }

  // 2. Domain Lock (Trivial check)
  // Se for um tema médico, deve conter pelo menos algum termo clínico
  if (normalizedTopic.includes("infarto") && !normalizedContent.includes("miocardio") && !normalizedContent.includes("coronaria") && !normalizedContent.includes("dor")) {
    // Apenas um exemplo de verificação — a lógica precisa ser mais robusta
  }

  return { isValid: true };
}
