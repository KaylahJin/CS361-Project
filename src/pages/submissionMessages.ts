// Thai text for every reason the API can give for refusing a submission.
// The codes come from infra/lambda/companies/eligibility.mjs and
// submissionRules.mjs; submissionMessages.test.ts reads those files and fails
// when a code there has no text here, so a new backend code cannot reach the
// screen as an English sentence or a raw code name.

export const SUBMISSION_FAILURE_LABELS: Record<string, string> = {
  // submissionRules.mjs
  PERIOD_REQUIRED: 'แผนนี้ยังไม่ได้เลือกรอบสหกิจ',
  POSITION_REQUIRED: 'กรุณาเลือกตำแหน่งงานก่อนยื่นแผน',
  PRE_COURSE_NOT_ACKNOWLEDGED: 'กรุณารับทราบเงื่อนไขก่อนเริ่มสหกิจ',
  TERMS_NOT_ACCEPTED: 'กรุณายอมรับข้อกำหนดและเงื่อนไข',
  SUBMISSION_WINDOW_NOT_DEFINED: 'รอบนี้ยังไม่กำหนดช่วงเวลายื่นแผน จึงยังยื่นไม่ได้',
  SUBMISSION_WINDOW_CLOSED: 'ยังไม่อยู่ในช่วงเวลาที่เปิดรับยื่นแผน',
  // eligibility.mjs
  STUDENT_RECORD_MISSING: 'ไม่พบข้อมูลนักศึกษาของแผนนี้ กรุณาติดต่อเจ้าหน้าที่',
  UNSUPPORTED_CURRICULUM: 'หลักสูตรของนักศึกษายังไม่รองรับการตรวจคุณสมบัติ',
  GPA_MISSING: 'ไม่มีข้อมูลเกรดเฉลี่ยของนักศึกษา จึงตรวจคุณสมบัติไม่ได้',
  GPA_BELOW_MINIMUM: 'เกรดเฉลี่ยยังไม่ผ่านเกณฑ์ที่กำหนด',
  COURSE_GROUP_GPA_BELOW_MINIMUM: 'เกรดเฉลี่ยในกลุ่มรายวิชายังไม่ผ่านเกณฑ์ที่กำหนด',
  REQUIRED_COURSES_MISSING: 'ยังเรียนรายวิชาบังคับไม่ครบตามที่กำหนด',
  ONGOING_OR_STUDIED_COURSE_MISSING: 'ยังไม่ผ่านเงื่อนไขรายวิชาที่กำหนด',
};

const GENERIC = 'กรุณาตรวจสอบข้อมูลและเงื่อนไขก่อนยื่นแผน';

/**
 * Thai text for one refusal. A code with no text yet falls back to the API's
 * own message so the screen is never blank, and never shows the code name.
 */
export function submissionFailureLabel(code?: string, message?: string): string {
  if (code && SUBMISSION_FAILURE_LABELS[code]) {
    return SUBMISSION_FAILURE_LABELS[code];
  }
  return message?.trim() || GENERIC;
}
