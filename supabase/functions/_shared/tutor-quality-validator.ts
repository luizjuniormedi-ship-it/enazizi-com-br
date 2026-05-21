/**
 * Tutor Pedagogical Quality Validator v2026
 * 
 * Verifies if an AI response contains all 15 mandatory pedagogical blocks.
 * Blocks must be present in the format "## 🎯 BLOCO X — NAME".
 */

export interface ValidationResult {
    isValid: boolean;
    missingBlocks: number[];
    presentBlocks: number[];
    score: number; // 0-100
}

export const MANDATORY_BLOCKS = [
    { id: 1, name: "MISSÃO DA SESSÃO" },
    { id: 2, name: "ROADMAP COGNITIVO" },
    { id: 3, name: "EXPLICAÇÃO LEIGA" },
    { id: 4, name: "EXPLICAÇÃO TÉCNICA" },
    { id: 5, name: "FISIOPATOLOGIA VISUAL" },
    { id: 6, name: "RACIOCÍNIO CLÍNICO" },
    { id: 7, name: "DIAGNÓSTICO DIFERENCIAL" },
    { id: 8, name: "PEGADINHAS DE PROVA" },
    { id: 9, name: "DIRETRIZES E EVIDÊNCIAS" },
    { id: 10, name: "QUESTÃO GUIADA" },
    { id: 11, name: "CORREÇÃO COMENTADA" },
    { id: 12, name: "ACTIVE RECALL" },
    { id: 13, name: "FLASHCARDS AUTOMÁTICOS" },
    { id: 14, name: "RESUMO ESTRATÉGICO" },
    { id: 15, name: "PLANO DE RECUPERAÇÃO" }
];

export function validateTutorResponse(text: string, options: { expectedBlock?: number | string } = {}): ValidationResult {
    // Skip validation for short responses, greetings, or common transitional phrases
    const shortText = text.trim().toLowerCase();
    const isShortInteraction = 
        text.length < 300 || 
        /^(oi|olá|ola|bom dia|boa tarde|boa noite|tchau|obrigado|ok|entendido|sim|não|continue|prossiga|pode explicar|explica mais|o que é|quem é|como|por que|ajuda|não entendi|não compreendi)/i.test(shortText) ||
        !text.includes("## 🎯 BLOCO");

    if (isShortInteraction) {
        return { isValid: true, missingBlocks: [], presentBlocks: [], score: 100 };
    }

    const presentBlocks: number[] = [];
    const missingBlocks: number[] = [];

    // If a specific block is expected (Gating V3), we only check for that one or the full set
    const expectedBlockNum = typeof options.expectedBlock === 'string' 
        ? parseInt(options.expectedBlock.match(/\d+/)?.[0] || '0')
        : options.expectedBlock;

    MANDATORY_BLOCKS.forEach(block => {
        const regex = new RegExp(`## 🎯 BLOCO ${block.id}`, "i");
        if (regex.test(text)) {
            presentBlocks.push(block.id);
        } else {
            missingBlocks.push(block.id);
        }
    });

    // V3 GATING LOGIC: If we are in gating mode and the specific expected block is present, it's valid
    let isValid = missingBlocks.length === 0;
    if (expectedBlockNum && presentBlocks.includes(expectedBlockNum)) {
        isValid = true;
    }

    const score = Math.round((presentBlocks.length / MANDATORY_BLOCKS.length) * 100);

    return {
        isValid,
        missingBlocks,
        presentBlocks,
        score
    };
}
