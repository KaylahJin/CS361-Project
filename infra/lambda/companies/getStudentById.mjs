import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';

const SELECT_BY_ID = `SELECT s.student_id, s.first_name, s.last_name, s.email, s.phone,
       to_char(s.birth_date, 'YYYY-MM-DD') AS birth_date,
       s.curriculum,
       s.gpa::float8 AS gpa,
       COALESCE(
         json_agg(
           json_build_object(
             'course_code', sc.course_code,
             'status',      sc.status,
             'grade_point', sc.grade_point::float8
           )
           ORDER BY sc.course_code
         ) FILTER (WHERE sc.course_code IS NOT NULL),
         '[]'::json
       ) AS courses
FROM students s
LEFT JOIN student_courses sc ON sc.student_id = s.student_id
WHERE s.student_id = $1
GROUP BY s.student_id`;

export async function getStudentById(event) {
  const studentId = event?.pathParameters?.studentId;

  if (typeof studentId !== 'string' || studentId.trim() === '') {
    return jsonResponse(400, { error: 'studentId is required' });
  }

  try {
    const result = await getPool().query(SELECT_BY_ID, [studentId.trim()]);

    if (result.rows.length === 0) {
      return jsonResponse(404, { error: 'Student not found' });
    }

    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    console.error('getStudentById failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}