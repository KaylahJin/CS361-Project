// ============================================================
// CS361 V2 — Shared Data-Context Labels
// ============================================================
// Issue: #86 — W1: ปรับรายละเอียดตำแหน่งให้โครงสร้างคงที่ และระบุความเป็นปัจจุบันของข้อมูล
// Position/Company records have no per-row verified-at field yet (see
// infra/schema.sql) — this is the single source until that lands.
// ============================================================

export const DATA_CONTEXT = {
  academicYearLabel: 'ข้อมูลประกาศปีการศึกษา 2568',
  lastVerifiedDate: '01/09/2569',
};
