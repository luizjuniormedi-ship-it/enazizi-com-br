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

export function validateTutorResponse(text: string): ValidationResult {
    const presentBlocks: number[] = [];
    const missingBlocks: number[] = [];

    MANDATORY_BLOCKS.forEach(block => {
        // Regex to find "## 🎯 BLOCO X" or variant
        const regex = new RegExp(`## 🎯 BLOCO ${block.id}`, "i");
        if (regex.test(text)) {
            presentBlocks.push(block.id);
        } else {
            missingBlocks.push(block.id);
        }
    });

    const score = Math.round((presentBlocks.length / MANDATORY_BLOCKS.length) * 100);

    return {
        isValid: missingBlocks.length === 0,
        missingBlocks,
        presentBlocks,
        score
    };
}
