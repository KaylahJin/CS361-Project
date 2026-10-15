
import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  ExternalLink,
  Search,
  X,
} from 'lucide-react';
import { getCompanies, CompanyApiError } from '../data/companyApi';
import type { Company, ProvinceOption } from '../types/company';
import { DATA_CONTEXT } from '../constants/dataContext';

const SEARCH_DEBOUNCE_MS = 300;

interface EmployersProps {
  onViewPositions: (company: Company) => void;
}

interface EmployerCardProps {
  company: Company;
  index: number;
  onViewPositions: (company: Company) => void;
}

/**
 * ตรวจสอบ URL เว็บไซต์ก่อนนำไปใช้เป็นลิงก์
 * รองรับ URL ที่ขึ้นต้นด้วย https://, http:// หรือไม่มี protocol
 * ปฏิเสธ protocol อื่นและ URL ที่ไม่ถูกต้อง
 */
const getSafeCompanyUrl = (rawUrl?: string | null): string | null => {
  const value = rawUrl?.trim();

  if (!value) return null;

  // อนุญาตเฉพาะ HTTP และ HTTPS
  if (
    /^[a-z][a-z\d+.-]*:/i.test(value) &&
    !/^https?:\/\//i.test(value)
  ) {
    return null;
  }

  try {
    const normalizedUrl = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`;

    const parsedUrl = new URL(normalizedUrl);

    if (
      !['http:', 'https:'].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname.includes('.')
    ) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
};

const EmployerCard: React.FC<EmployerCardProps> = ({
  company,
  index,
  onViewPositions,
}) => {
  const [hasError, setHasError] = useState(false);
  const safeUrl = getSafeCompanyUrl(company.url);

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {/* ลำดับรายการ */}
      <span className="w-5 shrink-0 select-none text-right text-xs font-bold text-slate-400 sm:w-7 sm:text-sm">
        {index + 1}
      </span>

      {/* การ์ดบริษัท ไม่ใช้ทั้งการ์ดเป็นลิงก์ภายนอก */}
      <article className="min-w-0 flex-1 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:border-blue-200 hover:shadow-md sm:rounded-3xl sm:p-6">
        <div className="flex min-w-0 items-center gap-4 sm:gap-8">
          {/* โลโก้บริษัท */}
          <div className="flex h-12 w-20 shrink-0 items-center justify-center sm:h-14 sm:w-36">
            {!hasError && company.logo_filename ? (
              <img
                src={`/images/logos/${company.logo_filename}`}
                alt={`โลโก้ ${company.name}`}
                onError={() => setHasError(true)}
                className="max-h-10 max-w-full object-contain sm:max-h-12"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl border border-slate-200/70 bg-slate-50 px-2 text-center text-xs font-bold text-slate-700">
                {company.short_name || company.company_id}
              </div>
            )}
          </div>

          {/* ข้อมูลบริษัท */}
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-sm font-bold leading-snug text-slate-900 sm:text-base">
              {company.name}
            </h3>

            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
              {company.location || 'ไม่ได้ระบุที่ตั้ง'}
            </p>
          </div>
        </div>

        {/* ปุ่มการทำงานของบริษัท */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={() => onViewPositions(company)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          >
            ดูตำแหน่งของบริษัทนี้
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>

          {safeUrl ? (
            <a
              href={safeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
            >
              เว็บไซต์บริษัท
              <ExternalLink
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </a>
          ) : (
            <span
              className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-50 px-4 py-2 text-center text-xs text-slate-400"
              title="ไม่มี URL เว็บไซต์ที่ใช้งานได้"
            >
              {company.url?.trim()
                ? 'เว็บไซต์ไม่พร้อมใช้งาน'
                : 'ไม่มีเว็บไซต์ในระบบ'}
            </span>
          )}
        </div>
      </article>
    </div>
  );
};

export const Employers: React.FC<EmployersProps> = ({
  onViewPositions,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedProvince, setSelectedProvince] = useState('');
  const [provinceOptions, setProvinceOptions] = useState<ProvinceOption[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // หน่วงเวลาค้นหาเพื่อลดจำนวน request
  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearch(searchTerm.trim()),
      SEARCH_DEBOUNCE_MS
    );

    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // โหลดข้อมูลบริษัททั้งหมดครั้งแรกเพื่อสร้างตัวกรองจังหวัดและนับจำนวนบริษัท
  useEffect(() => {
    getCompanies()
      .then((data) => {
        setTotalCount(data.length);

        const counts = new Map<string, number>();

        for (const company of data) {
          counts.set(
            company.province,
            (counts.get(company.province) ?? 0) + 1
          );
        }

        const provinces = Array.from(
          counts,
          ([province, count]) => ({ province, count })
        ).sort((a, b) => a.province.localeCompare(b.province, 'th'));

        setProvinceOptions(provinces);
      })
      .catch(() => {
        // ไม่ใช่ข้อผิดพลาดหลัก หากโหลดข้อมูลสำหรับตัวกรองไม่สำเร็จ
      });
  }, []);

  // โหลดรายการบริษัทตามคำค้นหาและจังหวัดที่เลือก
  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getCompanies({
      search: debouncedSearch || undefined,
      province: selectedProvince || undefined,
    })
      .then((data) => {
        if (!cancelled) {
          setCompanies(data);
        }
      })
      .catch((err) => {
        if (cancelled) return;

        setError(
          err instanceof CompanyApiError
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
  }, [debouncedSearch, selectedProvince]);

  // ข้อความเมื่อไม่พบข้อมูล
  const emptyMessage = (() => {
    if (debouncedSearch && selectedProvince) {
      return `ไม่พบสถานประกอบการที่ตรงกับคำค้น "${debouncedSearch}" ในจังหวัด${selectedProvince}`;
    }

    if (debouncedSearch) {
      return `ไม่พบสถานประกอบการที่ตรงกับคำค้น "${debouncedSearch}"`;
    }

    if (selectedProvince) {
      return `ไม่พบสถานประกอบการในจังหวัด${selectedProvince}`;
    }

    return 'ไม่พบสถานประกอบการ';
  })();

  return (
    <main className="min-h-screen w-full bg-white">
      {/* Hero Section */}
      <section className="px-4 pb-6 pt-16 text-center sm:pb-8 sm:pt-20">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
          <span className="text-blue-600">Co-op </span>
          <span className="text-slate-950">Opportunities</span>
        </h1>

        <p className="mt-3 text-xl font-bold text-slate-900 sm:text-2xl">
          สถานประกอบการและตำแหน่ง
          <span className="text-blue-600">สหกิจ</span>
        </p>

        {/* จำนวนบริษัทจากข้อมูลจริง */}
        {totalCount !== null && (
          <p className="mt-8 text-xs font-semibold tracking-wide text-blue-600 sm:text-sm">
            {totalCount} companies partner with us for cooperative education!
          </p>
        )}

        <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-blue-100/80 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700 sm:text-sm">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{DATA_CONTEXT.academicYearLabel}</span>
          <span className="text-blue-300">·</span>
          <span>ตรวจสอบล่าสุด {DATA_CONTEXT.lastVerifiedDate}</span>
        </div>
      </section>

      {/* Search + Province Filter */}
      <section className="mx-auto flex max-w-4xl flex-col gap-3 px-4 sm:flex-row sm:px-6 lg:px-8">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />

          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="ค้นหาด้วยชื่อสถานประกอบการ..."
            aria-label="ค้นหาด้วยชื่อสถานประกอบการ"
            className="w-full rounded-2xl border border-slate-200/90 py-3 pl-11 pr-11 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:text-base"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="ล้างคำค้นหา"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <select
          value={selectedProvince}
          onChange={(event) => setSelectedProvince(event.target.value)}
          aria-label="กรองตามจังหวัด"
          className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3 text-sm focus:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-300 sm:w-56 sm:text-base"
        >
          <option value="">ทุกจังหวัด</option>

          {provinceOptions.map(({ province, count }) => (
            <option key={province} value={province}>
              {province} ({count})
            </option>
          ))}
        </select>
      </section>

      {/* Employers Card List */}
      <section className="mx-auto max-w-4xl space-y-4 px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        {loading && (
          <p className="py-12 text-center text-slate-400">
            กำลังโหลดข้อมูล...
          </p>
        )}

        {error && (
          <p role="alert" className="py-12 text-center text-red-500">
            {error}
          </p>
        )}

        {!loading && !error && companies.length === 0 && (
          <p className="py-12 text-center text-slate-400">
            {emptyMessage}
          </p>
        )}

        {!loading &&
          !error &&
          companies.map((company, index) => (
            <EmployerCard
              key={company.company_id}
              company={company}
              index={index}
              onViewPositions={onViewPositions}
            />
          ))}
      </section>

      {/* Reference & Last Updated Timestamp */}
      <div className="mb-12 mt-6 space-y-2 text-center">
        <div>
          <a
            href="https://docs.google.com/spreadsheets/d/1mrexRW94TkVQUK91wLhqQtbEBResL4OBc9BWzcsvOjE/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline sm:text-sm"
          >
            แหล่งข้อมูลอ้างอิง: ทะเบียนสถานประกอบการปฏิบัติสหกิจศึกษา_2569 - Google ชีต
            <ExternalLink className="inline h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <div>
          <span className="text-xs tracking-wide text-slate-400">
            อัปเดตล่าสุด {DATA_CONTEXT.lastVerifiedDate}
          </span>
        </div>
      </div>
    </main>
  );
};

export default Employers;
