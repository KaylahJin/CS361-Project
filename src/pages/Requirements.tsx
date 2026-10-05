import React, { useEffect, useState } from 'react';
import { AlertCircle, Calendar, CheckCircle2, AlertTriangle } from 'lucide-react';
import HistoricalSection from '../components/HistoricalSection';
import { getCoopInfo } from '../data/coopInfoApi';
import type { CoopInfo } from '../types/coopInfo';

export const Requirements: React.FC = () => {
  const [coopInfo, setCoopInfo] = useState<CoopInfo[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadCoopInfo() {
      try {
        setLoading(true);
        setError(null);

        const data = await getCoopInfo({
          search,
          category,
        });

        setCoopInfo(data);
      } catch (err) {
        console.error('Failed to load coop info:', err);
        setError('ไม่สามารถโหลดข้อมูลข้อกำหนดสหกิจได้');
      } finally {
        setLoading(false);
      }
    }

    loadCoopInfo();
  }, [search, category]);

  // Group data by item number so that curriculum 61/66
  // can be displayed under the same requirement item.
  const groupedCoopInfo = coopInfo.reduce<Record<number, CoopInfo[]>>(
    (groups, item) => {
      if (!groups[item.item_number]) {
        groups[item.item_number] = [];
      }

      groups[item.item_number].push(item);
      return groups;
    },
    {}
  );

  const itemNumbers = Object.keys(groupedCoopInfo)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <main className="w-full min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-16 pb-8 sm:pt-20 sm:pb-12 text-center px-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
          <span className="text-blue-600">Cooperative Education </span>
          <span className="text-slate-950">Requirements</span>
        </h1>
        <p className="mt-3 text-xl sm:text-2xl font-bold text-slate-900">
          เกณฑ์และคุณสมบัติสหกิจศึกษา
        </p>
      </section>

      {/* Content Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* Prominent Notice Banner: Current year criteria not updated yet */}
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-900 shadow-xs flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>

          <div className="space-y-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-amber-950">
                สถานะข้อมูล: เกณฑ์ปีการศึกษาปัจจุบัน (2569) ยังไม่อัปเดต
              </span>

              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-200/80 text-amber-900 rounded-full">
                อ้างอิงข้อมูลปีก่อนหน้า
              </span>
            </div>

            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">
              ข้อมูลเกณฑ์และคุณสมบัติที่แสดงด้านล่างนี้เป็น{' '}
              <strong>เกณฑ์ของปีการศึกษา 2568 (ปีก่อนหน้า)</strong>{' '}
              เพื่อให้นักศึกษาใช้เป็นแนวทางในการเตรียมตัว
              โปรดรอประกาศเกณฑ์ทางการของปีการศึกษา 2569 อีกครั้ง
            </p>
          </div>
        </div>

        {/* Section Header & Subtitle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-8 border-b border-slate-200 gap-3">
          <div>
            <div className="inline-block px-3.5 py-1.5 bg-slate-100 text-slate-900 font-bold text-base sm:text-lg rounded-xl mb-1.5">
              เกณฑ์รับสมัครเข้าแผนสหกิจศึกษา
            </div>

            <div className="text-xs sm:text-sm font-semibold text-slate-500">
              ปีการศึกษา 2568
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80 w-fit">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>รอกำหนดการเกณฑ์ปี 2569</span>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="mb-8 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                ค้นหาข้อกำหนด
              </label>

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาจากหัวข้อหรือรายละเอียด..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="sm:w-56">
              <label className="block text-xs sm:text-sm font-semibold text-slate-700 mb-1.5">
                หมวดหมู่
              </label>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">ทุกหมวดหมู่</option>
                <option value="qualification">คุณสมบัติ</option>
                <option value="required_course">รายวิชา</option>
                <option value="gpa">GPA</option>
                <option value="behavior">ความประพฤติ</option>
              </select>
            </div>
          </div>
        </div>

        {/* Criteria List */}
        {loading ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>

            <p className="text-sm font-medium text-slate-600">
              กำลังโหลดข้อมูลข้อกำหนดสหกิจ...
            </p>
          </div>
        ) : error ? (
          <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />

              <div>
                <p className="font-bold text-sm">
                  ไม่สามารถโหลดข้อมูลได้
                </p>

                <p className="text-xs sm:text-sm mt-1">
                  {error}
                </p>
              </div>
            </div>
          </div>
        ) : coopInfo.length === 0 ? (
          <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <p className="text-sm font-semibold text-slate-700">
              ไม่พบข้อมูลข้อกำหนด
            </p>

            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              ลองเปลี่ยนคำค้นหาหรือหมวดหมู่แล้วลองอีกครั้ง
            </p>
          </div>
        ) : (
          <div className="space-y-6 text-slate-800">
            {itemNumbers.map((itemNumber) => {
              const items = groupedCoopInfo[itemNumber];
              const firstItem = items[0];

              return (
                <div
                  key={itemNumber}
                  className={
                    items.length > 1
                      ? 'p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3'
                      : 'flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs'
                  }
                >
                  {/* Item Number */}
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs sm:text-sm shrink-0 mt-0.5 border border-blue-100">
                    {itemNumber}
                  </span>

                  <div className={items.length > 1 ? 'flex-1' : 'text-xs sm:text-sm text-slate-800 leading-relaxed pt-0.5'}>
                    {/* Single item */}
                    {items.length === 1 ? (
                      <div>
                        <div className="font-bold text-slate-900 mb-1">
                          {firstItem.title}
                        </div>

                        <div className="font-medium">
                          {firstItem.description}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Requirement title */}
                        <div className="font-bold text-xs sm:text-sm text-slate-900 pt-0.5 mb-3">
                          {firstItem.title}
                        </div>

                        {/* Curriculum 61 / 66 */}
                        <div className="space-y-2.5 text-xs sm:text-sm">
                          {items.map((item) => (
                            <div
                              key={item.info_id}
                              className="p-3 rounded-xl bg-slate-50 border border-slate-100 leading-relaxed"
                            >
                              <span
                                className={
                                  item.curriculum === '61'
                                    ? 'font-bold text-blue-700 block sm:inline mr-1.5'
                                    : 'font-bold text-indigo-700 block sm:inline mr-1.5'
                                }
                              >
                                •{' '}
                                {item.curriculum === '61'
                                  ? 'หลักสูตร 61:'
                                  : 'หลักสูตร 66:'}
                              </span>

                              <span>{item.description}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selection Process and Conditions Card */}
        <div className="mt-8 p-5 sm:p-6 rounded-2xl bg-blue-50/60 border border-blue-100/90 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-blue-900 text-sm sm:text-base">
            <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
            <span>เงื่อนไขการคัดเลือกเข้าแผนสหกิจศึกษา</span>
          </div>

          <p className="pt-1">
            นักศึกษาที่ผ่านคุณสมบัติข้างต้นมีสิทธิ์ในการสมัครเพื่อคัดเลือกเข้าแผนสหกิจฯ เท่านั้น และจะไม่พิจารณานักศึกษาที่ไม่สามารถตรวจสอบได้ว่ามีคุณสมบัติครบถ้วน
          </p>

          <p>
            การคัดเลือกนักศึกษาเข้าแผนสหกิจฯ จะทำโดยคณะกรรมการบริหารสหกิจฯ ของสาขาวิชาฯ โดยจำนวนของนักศึกษาที่ได้รับการคัดเลือกขึ้นอยู่กับคุณสมบัติของนักศึกษา และภาระงานของอาจารย์ในสาขาวิชาฯ
          </p>

          <p className="font-bold text-slate-900 pt-1">
            ผลการคัดเลือกจากคณะกรรมการบริหารสหกิจฯ ถือเป็นที่สิ้นสุด
          </p>
        </div>

        {/* Note (Red Box) */}
        <div className="mt-6 p-4 rounded-xl bg-rose-50/70 border border-rose-200/80 text-rose-700 text-xs sm:text-sm font-medium flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />

          <span>
            <strong>หมายเหตุ :</strong>{' '}
            ขอสงวนสิทธิ์ในการเปลี่ยนแปลงข้อมูลตามความเหมาะสมสำหรับการจัดการโครงการสหกิจศึกษาในแต่ละปีการศึกษา โดยไม่แจ้งล่วงหน้า
          </span>
        </div>

        {/* Historical Data Section */}
        <HistoricalSection />
      </div>
    </main>
  );
};

export default Requirements;