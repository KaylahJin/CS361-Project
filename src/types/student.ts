// The fields a caller gets depend on their role, so the ones a role can be
// refused are optional here rather than merely nullable. An ADMIN response
// carries the identity columns and nothing else, and marking the rest optional
// is what makes tsc point at every place that reads one without checking —
// `student.gpa.toFixed(2)` against an admin's row would throw and take the
// page with it. See docs/permission-matrix.md for which role gets what.
export interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  curriculum: string;
  email?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  gpa?: number | null;
}

export interface StudentCourse {
  course_code: string;
  status: string;
  grade_point: number | null;
}

export interface StudentDetail extends Student {
  courses?: StudentCourse[];
}

export interface StudentQueryParams {
  search?: string;
  curriculum?: string;
}