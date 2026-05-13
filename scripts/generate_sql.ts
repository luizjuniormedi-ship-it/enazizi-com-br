
import { readTextFileSync } from "https://deno.land/std@0.168.0/fs/mod.ts";

const data = JSON.parse(readTextFileSync("validation_batch.json"));

function escapeSql(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/'/g, "''");
}

let sql = "INSERT INTO public.questions_bank (user_id, statement, options, correct_index, explanation, topic, is_global, review_status, quality_tier) VALUES ";

const values = data.map(q => {
  const optionsArr = q.options.map(opt => `'${escapeSql(opt)}'`).join(',');
  return `(
    '${q.user_id}', 
    '${escapeSql(q.statement)}', 
    ARRAY[${optionsArr}], 
    ${q.correct_index}, 
    '${escapeSql(q.explanation)}', 
    '${escapeSql(q.topic)}', 
    ${q.is_global}, 
    '${q.review_status}', 
    '${q.quality_tier}'
  )`;
});

sql += values.join(",\n") + ";";

console.log(sql);
