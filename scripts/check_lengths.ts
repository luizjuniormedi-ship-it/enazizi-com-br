
const data = JSON.parse(Deno.readTextFileSync("validation_batch.json"));
data.forEach((q, i) => {
  console.log(`Questão ${i+1}: ${q.statement.length} caracteres - ${q.topic}`);
});
