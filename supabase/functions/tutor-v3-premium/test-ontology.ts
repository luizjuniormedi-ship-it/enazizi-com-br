import { resolveMedicalDomain } from "../_shared/tutor/medical-ontology.ts";

const tests = [
  "IAM",
  "iam",
  "AWS IAM",
  "SCA",
  "tep",
  "AVC",
  "ave",
];

console.log("--- MEDICAL ONTOLOGY TEST ---");
for (const t of tests) {
  const res = resolveMedicalDomain(t);
  console.log(`Input: "${t}" -> Medical: ${res.isMedical}, Canonical: ${res.canonical}, Specialty: ${res.specialty}`);
}
