import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';
import { getPeriodTimeline, PeriodApiError } from '../data/periodAPI';
import type {
    ScheduleTimelineResponse,
    CoopSchedule,
} from '../types/period';

const ScheduleCard: React.FC<{
    schedule: CoopSchedule;
    index: number;
}> = ({ schedule, index }) => {
    const formatDate = (isoStr?: string) => {
        if (!isoStr) return '';
        return isoStr.split('T')[0];
    };

    const formatDateRange = (start?: string, end?: string) => {
        if (!start && !end) return 'รอกำหนดการ';

        const s = formatDate(start);
        const e = formatDate(end);

        if (s && !e) return `เริ่ม ${s}`;
        if (!s && e) return `ถึง ${e}`;
        if (s === e) return s;

        return `${s} ถึง ${e}`;
    };

    return (
        <div className="flex items-center gap-3 sm:gap-4">
            {/* Count Number Outside Card */}
            <span className="w-5 sm:w-7 text-right font-bold text-xs sm:text-sm text-slate-400 shrink-0 select-none">
                {schedule.step_order || index + 1}
            </span>

            {/* Card */}
            <div className="group flex-1 block border border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-6 bg-white shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200">
                <div className="flex items-start gap-5 sm:gap-8">

                    {/* Calendar Icon */}
                    <div className="w-20 sm:w-28 h-12 sm:h-14 flex items-center justify-center shrink-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600" />
                        </div>
                    </div>

                    {/* Schedule Info */}
                    <div className="min-w-0 flex-1">

                        {/* Activity Type + Active */}
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                                {schedule.activity_type}
                            </span>
                        </div>

                        {/* Title */}
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-blue-600 transition-colors leading-snug">
                            {schedule.title}
                        </h3>

                        {/* Description */}
                        {schedule.description && (
                            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                                {schedule.description}
                            </p>
                        )}

                        {/* Date */}
                        <div className="flex items-center gap-2 mt-3 text-xs sm:text-sm text-slate-500">
                            <Calendar className="w-4 h-4 shrink-0" />
                            <span>
                                {formatDateRange(
                                    schedule.start_date,
                                    schedule.end_date
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const Periods: React.FC = () => {
    const [timelineData, setTimelineData] =
        useState<ScheduleTimelineResponse | null>(null);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        getPeriodTimeline()
            .then((data) => {
                if (!cancelled) {
                    setTimelineData(data);
                }
            })
            .catch((err) => {
                if (cancelled) return;

                setError(
                    err instanceof PeriodApiError
                        ? `โหลดข้อมูลไม่สำเร็จ (${err.status})`
                        : 'โหลดข้อมูลไม่สำเร็จ'
                );
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <main className="w-full min-h-screen bg-white">

            {/* Hero Section */}
            <section className="pt-16 pb-6 sm:pt-20 sm:pb-8 text-center px-4">
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
                    <span className="text-slate-950">Co-op </span>
                    <span className="text-blue-600">Timelines</span>
                </h1>

                <p className="mt-3 text-xl sm:text-2xl font-bold text-slate-900">
                    <span className="text-blue-600">กำหนดการและขั้นตอน</span>
                    การปฏิบัติสหกิจศึกษา
                </p>
            </section>

            {/* Period Information */}
            {timelineData?.period && (
                <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                    <div className="border border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-6 bg-white shadow-2xs">

                        <div className="flex flex-wrap items-center gap-3">

                            {timelineData.period.is_active && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-xs sm:text-sm font-medium text-green-700">
                                    <CheckCircle2 className="w-4 h-4" />
                                    กำลังดำเนินการ
                                </span>
                            )}

                            <h2 className="font-bold text-slate-900 text-base sm:text-lg">
                                {timelineData.period.name}
                            </h2>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-500 mt-2">
                            ปีการศึกษา {timelineData.period.academic_year}{' '}
                            ภาคเรียนที่ {timelineData.period.semester}
                        </p>
                    </div>
                </section>
            )}

            {/* Schedules Card List Container */}
            <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 space-y-4">

                {/* Loading */}
                {loading && (
                    <div className="border border-slate-200/90 rounded-2xl sm:rounded-3xl p-8 bg-white text-center text-sm text-slate-500 shadow-2xs">
                        กำลังโหลดข้อมูล...
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="border border-red-200 rounded-2xl sm:rounded-3xl p-6 bg-red-50 text-center text-sm text-red-600">
                        {error}
                    </div>
                )}

                {/* Schedule List */}
                {!loading &&
                    !error &&
                    timelineData?.schedules &&
                    timelineData.schedules.length > 0 &&
                    timelineData.schedules.map((schedule, index) => (
                        <ScheduleCard
                            key={schedule.schedule_id}
                            schedule={schedule}
                            index={index}
                        />
                    ))}

                {/* Empty */}
                {!loading &&
                    !error &&
                    (!timelineData?.schedules ||
                        timelineData.schedules.length === 0) && (
                        <div className="border border-slate-200/90 rounded-2xl sm:rounded-3xl p-8 bg-white text-center text-sm text-slate-500 shadow-2xs">
                            ไม่พบข้อมูลกำหนดการ
                        </div>
                    )}
            </section>

            {/* Footer */}
            <div className="mt-6 mb-12 text-center space-y-2">
                <div>
                    <span className="text-xs sm:text-sm text-slate-400 font-medium">
                        Cooperative Education Management System
                    </span>
                </div>

                <div>
                    <span className="text-xs text-slate-400 tracking-wide">
                        ข้อมูลกำหนดการอาจมีการเปลี่ยนแปลงตามประกาศของคณะ
                    </span>
                </div>
            </div>
        </main>
    );
};

export default Periods;