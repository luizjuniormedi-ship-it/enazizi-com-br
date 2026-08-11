import { resolveMedicalDomain } from "./supabase/functions/_shared/tutor/medical-ontology.ts";

async function testAcronyms() {
  const cases = [
    { input: "IAM", expected: "Infarto Agudo do Miocárdio" },
    { input: "SCA", expected: "Síndrome Coronariana Aguda" },
    { input: "TEP", expected: "Tromboembolismo Pulmonar" },
    { input: "AWS IAM", expected: null },
    { input: "CAD", expected: "Cetoacidose Diabética" }
  ];

  console.log("=== ACRONYM RESOLUTION TEST ===");
  let passCount = 0;
  for (const c of cases) {
    const res = resolveMedicalDomain(c.input);
    const success = res.canonical === c.expected;
    console.log(`Input: ${c.input} | Expected: ${c.expected} | Got: ${c.canonical} | ${success ? "✅ PASS" : "❌ FAIL"}`);
    if (success) passCount++;
  }
  
  console.log(`\nResult: ${passCount}/${cases.length} passed.`);
}

testAcronyms();
