import React, { useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface CompanyLogo {
  id: string;
  name: string;
  filename: string;
}

const PARTNER_LOGOS: CompanyLogo[] = [
  // Row 1
  { id: 'agoda', name: 'agoda', filename: 'agoda.png' },
  { id: 'ais', name: 'AIS', filename: 'ais.png' },
  { id: 'ant', name: 'Ant', filename: 'ant.png' },
  { id: 'bitkub', name: 'bitkub', filename: 'bitkub.png' },
  { id: 'betagro', name: 'BETAGRO', filename: 'betagro.png' },
  { id: 'huawei', name: 'HUAWEI', filename: 'huawei.png' },
  // Row 2
  { id: 'cloud', name: 'Q-Cloud', filename: 'cloud.png' },
  { id: 'botnoi', name: 'BOTNOI', filename: 'botnoi.png' },
  { id: 'nimble', name: 'nimble', filename: 'nimble.png' },
  { id: 'airbnb', name: 'airbnb', filename: 'airbnb.png' },
  { id: 'pinterest', name: 'Pinterest', filename: 'pinterest.png' },
  { id: 'dropbox', name: 'Dropbox', filename: 'dropbox.png' },
  // Row 3
  { id: 'linkedin', name: 'LinkedIn', filename: 'linkedin.png' },
  { id: 'walmart', name: 'Walmart', filename: 'walmart.png' },
  { id: 'macys', name: "macy's", filename: 'macys.png' },
  { id: 'slack', name: 'slack', filename: 'slack.png' },
  { id: 'spotify', name: 'Spotify', filename: 'spotify.png' },
  { id: 'lowes', name: "LOWE'S", filename: 'lowes.png' },
];

const LogoItem: React.FC<{ logo: CompanyLogo }> = ({ logo }) => {
  const [hasError, setHasError] = useState(false);

  return (
    <div className="flex items-center justify-center p-2 h-12 w-full transition-transform hover:scale-105">
      {!hasError ? (
        <img
          src={`/images/logos/${logo.filename}`}
          alt={logo.name}
          onError={() => setHasError(true)}
          className="max-h-8 max-w-[100px] object-contain"
        />
      ) : (
        <span className="text-xs sm:text-sm font-bold text-slate-700 tracking-tight select-none">
          {logo.name}
        </span>
      )}
    </div>
  );
};

const PosterImage: React.FC<{ src: string; alt: string; title: string }> = ({ src, alt, title }) => {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-full aspect-[4/5] rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300/80 flex flex-col items-center justify-center p-6 text-center shadow-inner">
        <div className="w-16 h-16 rounded-2xl bg-white/80 shadow-xs flex items-center justify-center mb-3 text-blue-600 font-bold text-xl">
          {alt.slice(0, 2).toUpperCase()}
        </div>
        <p className="font-bold text-slate-800 text-base sm:text-lg mb-1">{title}</p>
        <p className="text-xs text-slate-500">[{alt}]</p>
        <span className="mt-4 text-xs font-medium px-3 py-1 bg-white/90 text-blue-600 rounded-full border border-blue-200">
          วางไฟล์รูปที่ /public/images/posters/{src.split('/').pop()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      className="w-full rounded-2xl object-cover shadow-xs border border-slate-100"
    />
  );
};

export const Employers: React.FC = () => {
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
          Over 22,000 companies partner with us for cooperative education!
        </p>
      </section>

      {/* Partner Logos Grid */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-8">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-4 items-center justify-items-center bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
          {PARTNER_LOGOS.map((logo) => (
            <LogoItem key={logo.id} logo={logo} />
          ))}
        </div>
      </section>

      {/* Section Divider / Label */}
      <div className="text-center my-6">
        <span className="text-xs text-slate-500 font-medium">
          รายละเอียด ปี 2568
        </span>
      </div>

      {/* Recruitment Cards Container */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 space-y-10">
        
        {/* Card 1: Agoda Thailand */}
        <article className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-4">
            Agoda Thailand
          </div>

          <div className="mb-6">
            <PosterImage
              src="/images/posters/poster-agoda.png"
              alt="Agoda Summer Intern 2025"
              title="Agoda Summer Internship 2025"
            />
          </div>

          <div className="text-xs sm:text-sm text-slate-700 space-y-4 leading-relaxed">
            <p className="font-medium text-slate-900">
              It's time for Agoda Summer Internship 2025!
            </p>
            <p>
              Kick-start your career with a 10-week program at Agoda’s Bangkok office. Work alongside brilliant minds from around the world, gain valuable skills through real-world projects, and build connections with interns across teams.
            </p>
            <p>
              Applications are open now—so what are you waiting for?
            </p>
            <p>
              <span className="font-semibold text-slate-900">Apply today:</span>{' '}
              <a
                href="https://ago-da.co/si24f"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
              >
                ago-da.co/si24f <ExternalLink className="w-3 h-3 inline" />
              </a>
            </p>
            <p className="text-blue-600 font-medium space-x-1">
              <span>#agoda</span>
              <span>#lifeatagoda</span>
              <span>#agodaintern</span>
            </p>
          </div>
        </article>

        {/* Card 2: AIS */}
        <article className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-4">
            AIS
          </div>

          <div className="mb-6">
            <PosterImage
              src="/images/posters/poster-ais.png"
              alt="AIS DIGITAL TALENT THE BLOOM"
              title="AIS DIGITAL TALENT – THE BLOOM"
            />
          </div>

          <div className="text-xs sm:text-sm text-slate-700 space-y-3 leading-relaxed">
            <p className="font-bold text-slate-900 text-sm sm:text-base">
              โอกาสสำคัญที่ ‘คนเก่ง’ อย่างคุณจะได้เฉิดฉาย
            </p>
            <p className="font-semibold text-slate-800">
              โครงการฝึกงาน AIS DIGITAL TALENT – THE BLOOM เปิดรับสมัครแล้ว!
            </p>
            <p className="text-slate-400">.</p>
            <p>
              สำหรับน้องๆ ปี 2-4 ที่สนใจฝึกงานกับเรา เรามีตำแหน่งรองรับหลากหลายคณะและสาขา ไม่ว่าจะสาย IT Data UX/UI PR Marketing Finance HR และอื่นๆ อีกเพียบ
            </p>
            <p className="text-slate-400">.</p>
            <p className="font-bold text-slate-900">“ฝึกงานแบบตัวตึง”</p>
            <p>
              สัมผัสประสบการณ์ฝึกงานที่จะช่วยให้คุณเก่งขึ้นไปอีกขั้น ด้วยการลงมือทำ จับงานจริง และเรียนรู้จากคนเก่งในทุกสายงานของเรา เพื่อสร้างเส้นทางอาชีพในอนาคตที่แข็งแกร่ง
            </p>
            <p className="text-slate-400">.</p>
            <p className="font-bold text-slate-900">“ฝึกงานให้คนจดจำ”</p>
            <p>
              ด้วยโปรเจกต์สำคัญที่จะสร้าง impact ของจริง ร่วมกับเพื่อนๆ จากหลากหลายสายงาน ได้แลกเปลี่ยนประสบการณ์ และเปิดมุมมองการทำงานที่กว้างขึ้น พร้อมโอกาสนำเสนอผลงานต่อผู้บริหารของบริษัท
            </p>
            <p className="text-slate-400">.</p>
            <p className="font-bold text-slate-900">“ฝึกงานเพื่อสร้าง profile”</p>
            <p>
              เสริมประวัติใน resume ให้แน่น และเพิ่มโอกาสในการร่วมงานกับเราในอนาคต มาเปลี่ยนอาชีพในฝันให้เป็นความจริงกับเรา
            </p>
            <p className="text-slate-400">.</p>
            <p className="font-bold text-rose-600">
              เปิดรับสมัครถึง 31 มกราคม 2568 เท่านั้น !
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href="#apply-ais"
                className="inline-flex items-center gap-1 text-xs font-semibold px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                สมัครเลย
              </a>
              <a
                href="#more-info-ais"
                className="inline-flex items-center gap-1 text-xs font-semibold px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                ดูข้อมูลเพิ่มเติม
              </a>
            </div>
          </div>
        </article>

        {/* Card 3: Ant HR */}
        <article className="border border-slate-200 rounded-3xl p-6 sm:p-8 bg-white shadow-xs">
          <div className="text-xs font-semibold text-slate-500 mb-4">
            Ant HR
          </div>

          <div className="mb-6">
            <PosterImage
              src="/images/posters/poster-anthr.png"
              alt="Ant HR SCG Internship"
              title="Ant HR – SCG Programmer Internship"
            />
          </div>

          <div className="text-xs sm:text-sm text-slate-700 space-y-3 leading-relaxed">
            <p className="font-bold text-slate-900 text-sm sm:text-base">
              ANT HR – START UP ด้าน HR TECH ภายใต้ SCG
            </p>
            <p className="font-semibold text-slate-800">
              รับสมัคร Internship ช่วงฝึกงานต้นปี 2568 ตำแหน่ง Programmer จำนวน 2 คน
            </p>
            <ul className="space-y-1.5 text-slate-600 my-3">
              <li className="flex items-start">
                <span className="mr-2 text-slate-400">•</span>
                <span>React JS / Node JS / SQL</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-400">•</span>
                <span>ระยะฝึกงาน 4 เดือนขึ้นไป</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-400">•</span>
                <span>เกรดเฉลี่ย 3.0 ขึ้นไป</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-400">•</span>
                <span>มีเบี้ยเลี้ยงวันละ 300-500 บาท</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-slate-400">•</span>
                <span>เข้างานแบบ Hybrid ที่ SCG บางซื่อ</span>
              </li>
            </ul>
            <p className="pt-2">
              <span className="font-semibold text-slate-900">ส่ง Resume/CV มาที่:</span>{' '}
              <a
                href="mailto:puttinum@scg.com"
                className="text-blue-600 font-medium hover:underline"
              >
                puttinum@scg.com
              </a>
            </p>
          </div>
        </article>

      </div>

      {/* Last Updated Timestamp */}
      <div className="mt-8 mb-12 text-center">
        <span className="text-xs text-slate-400 tracking-wide">
          อัปเดตล่าสุด -/-/2569
        </span>
      </div>
    </main>
  );
};

export default Employers;
