import React, { useEffect, useState } from 'react';
import { ExternalLink, Search, X } from 'lucide-react';
import { getCompanies, CompanyApiError } from '../data/companyApi';
import type { Company } from '../types/company';

const SEARCH_DEBOUNCE_MS = 300;

const EmployerCard: React.FC<{ company: Company; index: number }> = ({ company, index }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {/* Count Number Outside Card */}
      <span className="w-5 sm:w-7 text-right font-bold text-xs sm:text-sm text-slate-400 shrink-0 select-none">
        {index + 1}
      </span>

      {/* Card Link */}
      <a
        href={company.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex-1 block border border-slate-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-6 bg-white shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200 cursor-pointer"
      >
        <div className="flex items-center gap-5 sm:gap-8">
          {/* Logo Container */}
          <div className="w-24 sm:w-36 h-12 sm:h-14 flex items-center justify-center shrink-0">
            {!hasError && company.logo_filename ? (
              <img
                src={`/images/logos/${company.logo_filename}`}
                alt={company.name}
                onError={() => setHasError(true)}
                className="max-h-10 sm:max-h-12 max-w-full object-contain filter group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-50 border border-slate-200/70 rounded-xl px-2 text-center text-xs font-bold text-slate-700 select-none">
                {company.short_name || company.company_id}
              </div>
            )}
          </div>

          {/* Company Info */}
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base group-hover:text-blue-600 transition-colors leading-snug">
              {company.name}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">
              {company.location}
            </p>
          </div>
        </div>
      </a>
    </div>
  );
};

export const Employers: React.FC = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchTerm.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getCompanies({ search: debouncedSearch || undefined })
      .then((data) => {
        if (!cancelled) setCompanies(data);
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
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  return (
    <main className="w-full min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-16 pb-6 sm:pt-20 sm:pb-8 text-center px-4">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight">
          <span className="text-blue-600">Co-op </span>
          <span className="text-slate-950">Opportunities</span>
        </h1>
        <p className="mt-3 text-xl sm:text-2xl font-bold text-slate-900">
          สถานประกอบการและตำแหน่ง<span className="text-blue-600">สหกิจ</span>
        </p>

        {/* Partner Count Slogan */}
        <p className="mt-8 text-xs sm:text-sm font-semibold text-blue-600 tracking-wide">
          Over 100 companies partner with us for cooperative education!
        </p>
      </section>

      {/* Search */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาด้วยชื่อสถานประกอบการ..."
            aria-label="ค้นหาด้วยชื่อสถานประกอบการ"
            className="w-full pl-11 pr-11 py-3 rounded-2xl border border-slate-200/90 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="ล้างคำค้นหา"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* Employers Card List Container */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-16 space-y-4">
        {loading && (
          <p className="text-center text-slate-400 py-12">กำลังโหลดข้อมูล...</p>
        )}
        {error && (
          <p className="text-center text-red-500 py-12">{error}</p>
        )}
        {!loading && !error && companies.length === 0 && (
          <p className="text-center text-slate-400 py-12">
            {debouncedSearch
              ? `ไม่พบสถานประกอบการที่ตรงกับคำค้น "${debouncedSearch}"`
              : 'ไม่พบสถานประกอบการ'}
          </p>
        )}
        {!loading && !error && companies.map((company, index) => (
          <EmployerCard key={company.company_id} company={company} index={index} />
        ))}
      </section>

      {/* Reference & Last Updated Timestamp */}
      <div className="mt-6 mb-12 text-center space-y-2">
        <div>
          <a
            href="https://docs.google.com/spreadsheets/d/1mrexRW94TkVQUK91wLhqQtbEBResL4OBc9BWzcsvOjE/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-700 hover:underline font-medium"
          >
            แหล่งข้อมูลอ้างอิง: ทะเบียนสถานประกอบการปฏิบัติสหกิจศึกษา_2569 - Google ชีต
            <ExternalLink className="w-3.5 h-3.5 inline" />
          </a>
        </div>
        <div>
          <span className="text-xs text-slate-400 tracking-wide">
            อัปเดตล่าสุด 01/09/2569
          </span>
        </div>
      </div>
    </main>
  );
};

export default Employers;
