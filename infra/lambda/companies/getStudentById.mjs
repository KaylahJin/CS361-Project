// GET /students/{studentId} — one student, behind the JWT authorizer.
//
// The caller's scope is part of the WHERE clause, so zero rows is the single
// answer to both "no such student" and "that student is not yours", and the
// handler cannot tell them apart either. Both are 404: a student id names a
// real person, and confirming one exists is itself a disclosure. See
// docs/permission-matrix.md for the rule and why the coop-plan routes, keyed
// on a surrogate plan_id, answer 403 instead.
//
// Which columns come back is decided by authorize.mjs. A role with no
// academic rights does not join student_courses at all, so the grades are
// never read, let alone serialized.

import { getPool } from './db.mjs';
import { jsonResponse } from './response.mjs';
import { getAuthenticatedUser } from './auth.mjs';
import { buildStudentScope, studentColumnsFor, ForbiddenError } from './authorize.mjs';

const COURSES_COLUMN = `COALESCE(
         json_agg(
           json_build_object(
             'course_code', sc.course_code,
             'status',      sc.status,
             'grade_point', sc.grade_point::float8
           )
           ORDER BY sc.course_code
         ) FILTER (WHERE sc.course_code IS NOT NULL),
         '[]'::json
       ) AS courses`;

export async function getStudentById(event) {
  // Identity before input validation: an anonymous caller learns nothing
  // about this route's parameters, and the 400 below is for signed-in callers
  // who sent a malformed id.
  let scope;
  let columns;
  let includeCourses;
  try {
    const { user, denied } = await getAuthenticatedUser(event);
    if (denied) {
      return jsonResponse(denied.status, { error: denied.error });
    }

    scope = await buildStudentScope(user);
    ({ columns, includeCourses } = studentColumnsFor(user));
  } catch (err) {
    if (err instanceof ForbiddenError) {
      console.error('getStudentById forbidden', err.message);
      return jsonResponse(403, { error: 'Forbidden' });
    }
    console.error('getStudentById auth failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }

  const studentId = event?.pathParameters?.studentId;

  if (typeof studentId !== 'string' || studentId.trim() === '') {
    return jsonResponse(400, { error: 'studentId is required' });
  }

  try {
    const values = [studentId.trim()];
    const add = (value) => {
      values.push(value);
      return `$${values.length}`;
    };

    // The requested id is $1; the scope params follow it.
    let where = 's.student_id = $1';
    if (scope.sql) {
      let scopeSql = scope.sql;
      for (const param of scope.params) {
        scopeSql = scopeSql.replace('$PARAM', add(param));
      }
      where = `${where}\n  AND ${scopeSql}`;
    }

    const selected = includeCourses ? [...columns, COURSES_COLUMN] : columns;

    const text = `SELECT ${selected.join(',\n       ')}
FROM students s${
      includeCourses ? '\nLEFT JOIN student_courses sc ON sc.student_id = s.student_id' : ''
    }
WHERE ${where}${includeCourses ? '\nGROUP BY s.student_id' : ''}`;

    const result = await getPool().query(text, values);

    if (result.rows.length === 0) {
      return jsonResponse(404, { error: 'Student not found' });
    }

    return jsonResponse(200, result.rows[0]);
  } catch (err) {
    console.error('getStudentById failed', err);
    return jsonResponse(500, { error: 'Internal server error' });
  }
}
