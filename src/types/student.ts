export interface Student {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  birth_date: string | null;
  curriculum: string;
  gpa: number | null;
}

export interface StudentCourse {
  course_code: string;
  status: string;
  grade_point: number | null;
}

export interface StudentDetail extends Student {
  courses: StudentCourse[];
}

export interface StudentQueryParams {
  search?: string;
  curriculum?: string;
}