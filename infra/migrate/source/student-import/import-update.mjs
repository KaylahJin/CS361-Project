export function mergeStudentForUpdate(existing, incoming) {
  return {
    phone: incoming.phone ?? existing.phone,
    birth_date: incoming.birth_date ?? existing.birth_date,
    gpa: incoming.gpa ?? existing.gpa,
  };
}
