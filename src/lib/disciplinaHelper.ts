export function getDisciplinaLabel(disciplina: any): string {
  return (
    disciplina?.nome ??
    disciplina?.titulo ??
    disciplina?.title ??
    disciplina?.name ??
    disciplina?.disciplina ??
    "Disciplina não informada"
  );
}
