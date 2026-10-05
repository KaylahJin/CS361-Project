import { useEffect, useState } from 'react';
import {
  Search,
  GraduationCap,
  X,
  User,
  Mail,
  Phone,
  Calendar,
  BookOpen,
  AlertCircle,
  Loader2,
} from 'lucide-react';

import { getStudent, getStudents } from '../data/studentApi';

import type {
  Student,
  StudentDetail,
  StudentCourse,
} from '../types/student';

import studentsData from '../data/studentsData.json';

/* ============================================================
   API timeout helper
   ============================================================ */

const fetchWithTimeout = async <T,>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
};

function Students() {
  /* ============================================================
     Student List State
     ============================================================ */

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* ============================================================
     Search / Filter State
     ============================================================ */

  const [search, setSearch] = useState('');
  const [curriculum, setCurriculum] = useState('');

  /* ============================================================
     Student Detail State
     ============================================================ */

  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [selectedStudent, setSelectedStudent] =
    useState<StudentDetail | null>(null);

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  /* ============================================================
     Convert local JSON data to Student type
     ============================================================ */

  const localStudents: Student[] = studentsData.map((student) => ({
    student_id: student.studentId,
    first_name: student.firstName,
    last_name: student.lastName,
    email: student.email,
    phone: student.phone,
    birth_date: student.birthDate,
    curriculum: student.curriculum,
    gpa: student.gpa,
    courses: student.courses.map((course) => ({
      course_code: course.courseCode,
      status: course.status,
      grade_point: course.gradePoint,
    })),
  }));

  /* ============================================================
     Filter local JSON data
     Used when API is unavailable / timeout
     ============================================================ */

  const getFilteredLocalStudents = (
    searchValue: string,
    curriculumValue: string
  ): Student[] => {
    const keyword = searchValue.trim().toLowerCase();

    return localStudents.filter((student) => {
      const matchesSearch =
        !keyword ||
        student.student_id.toLowerCase().includes(keyword) ||
        `${student.first_name} ${student.last_name}`
          .toLowerCase()
          .includes(keyword);

      const matchesCurriculum =
        !curriculumValue ||
        student.curriculum === curriculumValue;

      return matchesSearch && matchesCurriculum;
    });
  };

  /* ============================================================
     Load Student List
     
     API first
     - Success within 10 seconds -> use API data
     - Error / timeout -> use local JSON
     ============================================================ */

  const loadStudents = async (
    searchValue = search,
    curriculumValue = curriculum
  ) => {
    try {
      setLoading(true);
      setError('');

      const data = await fetchWithTimeout(
        getStudents({
          search: searchValue.trim() || undefined,
          curriculum: curriculumValue || undefined,
        }),
        10000
      );

      setStudents(data);
    } catch (err) {
      console.warn(
        'Student API is unavailable or timed out. Using local studentsData.json instead.',
        err
      );

      const fallbackData = getFilteredLocalStudents(
        searchValue,
        curriculumValue
      );

      setStudents(fallbackData);
      setError('');
    } finally {
      setLoading(false);
    }
  };

  /* ============================================================
     Initial Load
     ============================================================ */

  useEffect(() => {
    loadStudents();

    // loadStudents uses the initial search/filter values here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============================================================
     Search
     ============================================================ */

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    loadStudents(search, curriculum);
  };

  /* ============================================================
     Curriculum Filter
     ============================================================ */

  const handleCurriculumChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value;

    setCurriculum(value);
    loadStudents(search, value);
  };

  /* ============================================================
     Open Student Detail
     
     API first
     - Success within 10 seconds -> use API data
     - Error / timeout -> use local JSON
     ============================================================ */

  const handleStudentClick = async (studentId: string) => {
    setIsDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setSelectedStudent(null);

    try {
      const data = await fetchWithTimeout(
        getStudent(studentId),
        10000
      );

      setSelectedStudent(data);
    } catch (error) {
      console.warn(
        `Student API is unavailable or timed out. Using local data for ${studentId}.`,
        error
      );

      const localStudent = localStudents.find(
        (student) => student.student_id === studentId
      );

      if (localStudent) {
        setSelectedStudent(localStudent as StudentDetail);
      } else {
        setSelectedStudent(null);
        setDetailError('ไม่พบข้อมูลนักศึกษา');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  /* ============================================================
     Close Student Detail Modal
     ============================================================ */

  const handleCloseDetail = () => {
    setIsDetailOpen(false);
    setSelectedStudent(null);
    setDetailError('');
    setDetailLoading(false);
  };

  /* ============================================================
     Course Status Helpers
     ============================================================ */

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PASSED':
        return 'ผ่าน';

      case 'ENROLLED':
        return 'กำลังเรียน';

      case 'FAILED':
        return 'ไม่ผ่าน';

      case 'DROPPED':
        return 'ถอนรายวิชา';

      default:
        return status || '-';
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'PASSED':
        return 'bg-green-50 text-green-700 border-green-200';

      case 'ENROLLED':
        return 'bg-blue-50 text-blue-700 border-blue-200';

      case 'FAILED':
        return 'bg-red-50 text-red-700 border-red-200';

      case 'DROPPED':
        return 'bg-gray-50 text-gray-600 border-gray-200';

      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  return (
    <main className="bg-white min-h-screen">

      {/* ======================================================
          Page Header
      ======================================================= */}

      <section className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            <span className="text-blue-600">Student</span>{' '}
            <span className="text-slate-950">List</span>
          </h1>

          <h2 className="mt-2 text-xl sm:text-2xl font-black text-slate-900">
            ข้อมูลนักศึกษา
          </h2>

          <p className="mt-4 text-sm text-slate-500 max-w-2xl mx-auto leading-6">
            ตรวจสอบข้อมูลพื้นฐานของนักศึกษา
            และประวัติผลการเรียนสำหรับการจัดการข้อมูลสหกิจศึกษา
          </p>

        </div>
      </section>

      {/* ======================================================
          Content
      ======================================================= */}

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ====================================================
            Search / Filter
        ===================================================== */}

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">

          <div className="flex flex-col lg:flex-row gap-4">

            {/* Search */}

            <form
              onSubmit={handleSearch}
              className="flex-1 relative"
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหารหัสนักศึกษา หรือชื่อ..."
                className="w-full h-11 pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </form>

            {/* Curriculum */}

            <div className="w-full lg:w-56">
              <select
                value={curriculum}
                onChange={handleCurriculumChange}
                className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">ทุกหลักสูตร</option>
                <option value="61">หลักสูตร 61</option>
                <option value="66">หลักสูตร 66</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => loadStudents(search, curriculum)}
              disabled={loading}
              className="h-11 px-6 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังโหลด...' : 'ค้นหา'}
            </button>

          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">

            <span className="text-sm text-slate-500">
              รายชื่อนักศึกษา
            </span>

            <span className="text-sm font-semibold text-slate-700">
              {loading
                ? 'กำลังโหลด...'
                : `${students.length} คน`}
            </span>

          </div>

        </div>

        {/* ====================================================
            Student Table
        ===================================================== */}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">

          {/* Loading */}

          {loading && (
            <div className="min-h-[300px] flex flex-col items-center justify-center">

              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />

              <p className="mt-3 text-sm text-slate-500">
                กำลังโหลดข้อมูลนักศึกษา...
              </p>

              <p className="mt-1 text-xs text-slate-400">
                กำลังเชื่อมต่อกับระบบ
              </p>

            </div>
          )}

          {/* Error */}

          {!loading && error && (
            <div className="min-h-[300px] flex flex-col items-center justify-center px-6">

              <AlertCircle className="w-8 h-8 text-red-500" />

              <p className="mt-3 text-sm text-red-600">
                {error}
              </p>

              <button
                onClick={() => loadStudents(search, curriculum)}
                className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                ลองอีกครั้ง
              </button>

            </div>
          )}

          {/* Empty */}

          {!loading && !error && students.length === 0 && (
            <div className="min-h-[300px] flex flex-col items-center justify-center px-6 text-center">
              <GraduationCap className="w-10 h-10 text-slate-300" />

              <p className="mt-3 text-sm font-semibold text-slate-600">
                ไม่พบข้อมูลนักศึกษา
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {search.trim() || curriculum
                  ? 'ไม่พบข้อมูลที่ตรงกับคำค้นหาหรือเงื่อนไขการกรอง'
                  : 'ยังไม่มีข้อมูลนักศึกษา'}
              </p>

              {(search.trim() || curriculum) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCurriculum('');
                    loadStudents('', '');
                  }}
                  className="mt-4 px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition"
                >
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          )}

          {/* Table */}

          {!loading &&
            !error &&
            students.length > 0 && (
              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">

                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500">
                        รหัสนักศึกษา
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500">
                        ชื่อ - นามสกุล
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-bold text-slate-500">
                        หลักสูตร
                      </th>

                      <th className="px-6 py-4 text-center text-xs font-bold text-slate-500">
                        GPAX
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-bold text-slate-500">
                        รายละเอียด
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {students.map((student) => (
                      <tr
                        key={student.student_id}
                        onClick={() =>
                          handleStudentClick(
                            student.student_id
                          )
                        }
                        className="hover:bg-blue-50/40 cursor-pointer transition"
                      >

                        <td className="px-6 py-4">
                          <span className="font-semibold text-blue-600">
                            {student.student_id}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-800">
                            {student.first_name}{' '}
                            {student.last_name}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                            {student.curriculum || '-'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-center">
                          <span className="font-bold text-slate-800">
                            {student.gpa != null
                              ? student.gpa.toFixed(2)
                              : '-'}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStudentClick(
                                student.student_id
                              );
                            }}
                            className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-blue-100 hover:text-blue-700 transition"
                          >
                            ดูรายละเอียด
                          </button>

                        </td>

                      </tr>
                    ))}

                  </tbody>

                </table>

              </div>
            )}

        </div>

      </section>

      {/* ======================================================
          Student Detail Modal
      ======================================================= */}

      {isDetailOpen && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleCloseDetail}
        >

          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl"
          >

            {/* ==================================================
                Modal Header
            =================================================== */}

            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">

              <div>

                <h2 className="text-xl font-black text-slate-900">
                  รายละเอียดนักศึกษา
                </h2>

                {selectedStudent && (
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedStudent.student_id}
                  </p>
                )}

              </div>

              <button
                onClick={handleCloseDetail}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X className="w-5 h-5" />
              </button>

            </div>

            {/* ==================================================
                Loading Detail
            =================================================== */}

            {detailLoading && (
              <div className="h-80 flex flex-col items-center justify-center">

                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />

                <p className="mt-3 text-sm text-slate-500">
                  กำลังโหลดรายละเอียดนักศึกษา...
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  กำลังเชื่อมต่อกับระบบ
                </p>

              </div>
            )}

            {/* ==================================================
                Detail Error
            =================================================== */}

            {!detailLoading && detailError && (
              <div className="h-80 flex flex-col items-center justify-center">

                <AlertCircle className="w-8 h-8 text-red-500" />

                <p className="mt-3 text-sm text-red-600">
                  {detailError}
                </p>

              </div>
            )}

            {/* ==================================================
                Detail Content
            =================================================== */}

            {!detailLoading &&
              !detailError &&
              selectedStudent && (
                <div className="overflow-y-auto max-h-[calc(90vh-80px)]">

                  {/* Basic information */}

                  <div className="p-6">

                    <div className="flex items-center gap-4 mb-6">

                      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                        <User className="w-7 h-7 text-blue-600" />
                      </div>

                      <div>

                        <h3 className="text-xl font-black text-slate-900">
                          {selectedStudent.first_name}{' '}
                          {selectedStudent.last_name}
                        </h3>

                        <p className="text-sm text-slate-500">
                          รหัสนักศึกษา{' '}
                          {selectedStudent.student_id}
                        </p>

                      </div>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      <InfoItem
                        icon={
                          <BookOpen className="w-4 h-4" />
                        }
                        label="หลักสูตร"
                        value={
                          selectedStudent.curriculum || '-'
                        }
                      />

                      <InfoItem
                        icon={
                          <GraduationCap className="w-4 h-4" />
                        }
                        label="GPAX"
                        value={
                          selectedStudent.gpa != null
                            ? selectedStudent.gpa.toFixed(2)
                            : '-'
                        }
                      />

                      <InfoItem
                        icon={
                          <Mail className="w-4 h-4" />
                        }
                        label="อีเมล"
                        value={
                          selectedStudent.email || '-'
                        }
                      />

                      <InfoItem
                        icon={
                          <Phone className="w-4 h-4" />
                        }
                        label="เบอร์โทรศัพท์"
                        value={
                          selectedStudent.phone || '-'
                        }
                      />

                      <InfoItem
                        icon={
                          <Calendar className="w-4 h-4" />
                        }
                        label="วันเกิด"
                        value={
                          selectedStudent.birth_date || '-'
                        }
                      />

                    </div>

                  </div>

                  {/* Course history */}

                  <div className="border-t border-slate-200">

                    <div className="px-6 py-5 flex items-center justify-between">

                      <div>

                        <h3 className="font-black text-slate-900">
                          ประวัติผลการเรียน
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          รายวิชาและผลการเรียนของนักศึกษา
                        </p>

                      </div>

                      <span className="text-xs font-semibold text-slate-500">
                        {selectedStudent.courses.length}{' '}
                        รายวิชา
                      </span>

                    </div>

                    {selectedStudent.courses.length === 0 ? (

                      <div className="px-6 pb-8 text-center">

                        <p className="text-sm text-slate-400">
                          ยังไม่มีข้อมูลรายวิชา
                        </p>

                      </div>

                    ) : (

                      <div className="px-6 pb-6 overflow-x-auto">

                        <table className="w-full">

                          <thead>

                            <tr className="bg-slate-50 border-y border-slate-200">

                              <th className="px-4 py-3 text-left text-xs font-bold text-slate-500">
                                รหัสวิชา
                              </th>

                              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500">
                                สถานะ
                              </th>

                              <th className="px-4 py-3 text-center text-xs font-bold text-slate-500">
                                Grade Point
                              </th>

                            </tr>

                          </thead>

                          <tbody className="divide-y divide-slate-100">

                            {selectedStudent.courses.map(
                              (course: StudentCourse) => (
                                <tr key={course.course_code}>

                                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                                    {course.course_code}
                                  </td>

                                  <td className="px-4 py-3 text-center">

                                    <span
                                      className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusClass(
                                        course.status
                                      )}`}
                                    >
                                      {getStatusLabel(
                                        course.status
                                      )}
                                    </span>

                                  </td>

                                  <td className="px-4 py-3 text-center">

                                    <span className="text-sm font-bold text-slate-800">
                                      {course.grade_point !=
                                      null
                                        ? course.grade_point.toFixed(
                                            2
                                          )
                                        : '-'}
                                    </span>

                                  </td>

                                </tr>
                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    )}

                  </div>

                </div>
              )}

          </div>

        </div>
      )}

    </main>
  );
}

/* ============================================================
   Info Item
   ============================================================ */

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function InfoItem({
  icon,
  label,
  value,
}: InfoItemProps) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">

      <div className="flex items-center gap-2 text-xs text-slate-500">
        {icon}
        <span>{label}</span>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-800 break-words">
        {value}
      </p>

    </div>
  );
}

export default Students;