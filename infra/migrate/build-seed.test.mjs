import { describe, it, expect } from 'vitest';
import {
  extractProvince,
  parseRegistryCodes,
  resolveProvince,
  toSeedRows,
  sqlStr,
} from './build-seed.mjs';

describe('extractProvince', () => {
  it('special-cases any Bangkok-containing string to กรุงเทพมหานคร', () => {
    expect(extractProvince('202 ถนนนางลิ้นจี่ แขวงช่องนนทรี เขตยานนาวา กรุงเทพมหานคร 10120')).toBe(
      'กรุงเทพมหานคร'
    );
    expect(extractProvince('บางส่วนของ กรุงเทพ ฝั่งธนบุรี')).toBe('กรุงเทพมหานคร');
  });

  it('matches a known province via the "จังหวัด" prefix', () => {
    expect(extractProvince('99 หมู่ 1 ตำบลบางพระ จังหวัดชลบุรี 20000')).toBe('ชลบุรี');
  });

  it('matches a known province via the "จ." prefix', () => {
    expect(extractProvince('99 หมู่ 1 ตำบลบางพระ จ.ชลบุรี 20000')).toBe('ชลบุรี');
  });

  it('matches a bare substring when the province name appears directly in the address', () => {
    expect(extractProvince('ถนนพหลโยธิน ตำบลคลองหนึ่ง อำเภอคลองหลวง ปทุมธานี 12120')).toBe(
      'ปทุมธานี'
    );
  });

  it('falls back to English regexes, case-insensitively', () => {
    expect(extractProvince('123 Sukhumvit Road, Bangkok 10110')).toBe('กรุงเทพมหานคร');
    expect(extractProvince('123 Main Rd, BANGKOK')).toBe('กรุงเทพมหานคร');
    expect(extractProvince('88 Moo 4, Pathumthani 12000')).toBe('ปทุมธานี');
    expect(extractProvince('88 Moo 4, Pathum Thani 12000')).toBe('ปทุมธานี');
    expect(extractProvince('88 Moo 4, pathum   thani 12000')).toBe('ปทุมธานี');
    expect(extractProvince('10 Tiwanon Rd, Nonthaburi 11000')).toBe('นนทบุรี');
    expect(extractProvince('10 Tiwanon Rd, NONTHABURI')).toBe('นนทบุรี');
  });

  it('returns null when nothing matches', () => {
    expect(extractProvince('an address with no recognizable province at all')).toBeNull();
  });
});

describe('sqlStr', () => {
  it('renders null as the unquoted literal NULL', () => {
    expect(sqlStr(null)).toBe('NULL');
  });

  it('renders undefined as the unquoted literal NULL', () => {
    expect(sqlStr(undefined)).toBe('NULL');
  });

  it('doubles an embedded single quote for SQL escaping', () => {
    expect(sqlStr("O'Brien's Co")).toBe("'O''Brien''s Co'");
  });

  it('wraps a plain string in single quotes', () => {
    expect(sqlStr('CDG Group')).toBe("'CDG Group'");
  });
});

describe('resolveProvince', () => {
  it('prefers the province extracted from the address itself', () => {
    expect(resolveProvince('C01', '202 ถนนนางลิ้นจี่ กรุงเทพมหานคร 10120', { C01: 'ชลบุรี' })).toEqual({
      province: 'กรุงเทพมหานคร',
      source: 'v1-address',
    });
  });

  it('falls back to the curated per-code map when the address has no province', () => {
    expect(resolveProvince('C30', '127 อาคารเกษร ทาวเวอร์ ชั้น 14-16 ถนนราชดำริ', { C30: 'กรุงเทพมหานคร' })).toEqual(
      { province: 'กรุงเทพมหานคร', source: 'fallback-map' }
    );
  });

  it('reports no province at all rather than inventing one', () => {
    // The old script defaulted these to กรุงเทพมหานคร, silently mis-filtering them.
    expect(resolveProvince('C99', 'ที่อยู่ที่ไม่มีจังหวัด', {})).toEqual({
      province: null,
      source: 'unresolved',
    });
  });
});

describe('toSeedRows', () => {
  const v1 = [
    {
      id: 'C01',
      code: 'C01',
      name: 'บริษัท ซีดีจี กรุ๊ป จำกัด',
      shortName: 'CDG Group',
      address: '202 ถนนนางลิ้นจี่ แขวงช่องนนทรี เขตยานนาวา กรุงเทพมหานคร 10120',
      logoFilename: 'cdg.png',
      url: 'https://www.cdg.co.th/join-us/',
    },
    {
      id: 'C09',
      code: 'C09',
      name: 'บริษัท เงินเทอร์โบ จำกัด (มหาชน)',
      shortName: 'Ngern Turbo',
      address: '500 หมู่ 3 ถนนติวานนท์ ตำบลบ้านใหม่ อำเภอปากเกร็ด จังหวัดนนทบุรี 11120',
      logoFilename: 'ngernturbo.png',
      url: 'https://www.ngernturbo.com/',
    },
  ];

  it('maps every V1 company onto the companies table columns', () => {
    const { rows } = toSeedRows(v1, {}, new Set());
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      company_id: 'C01',
      name: 'บริษัท ซีดีจี กรุ๊ป จำกัด',
      short_name: 'CDG Group',
      province: 'กรุงเทพมหานคร',
      location: '202 ถนนนางลิ้นจี่ แขวงช่องนนทรี เขตยานนาวา กรุงเทพมหานคร 10120',
      logo_filename: 'cdg.png',
      url: 'https://www.cdg.co.th/join-us/',
    });
    expect(rows[1].province).toBe('นนทบุรี');
  });

  it('collapses runs of whitespace in every text field', () => {
    const { rows } = toSeedRows(
      [{ code: 'C01', name: '  บริษัท   ซีดีจี  ', shortName: 'CDG   Group', address: ' 202  ถนน กรุงเทพมหานคร ' }],
      {},
      new Set()
    );
    expect(rows[0].name).toBe('บริษัท ซีดีจี');
    expect(rows[0].short_name).toBe('CDG Group');
    expect(rows[0].location).toBe('202 ถนน กรุงเทพมหานคร');
  });

  it('emits NULL-able optional fields as null, never as empty string', () => {
    const { rows } = toSeedRows([{ code: 'C01', name: 'บ. ทดสอบ', address: 'กรุงเทพมหานคร', shortName: '', url: '' }], {}, new Set());
    expect(rows[0].short_name).toBeNull();
    expect(rows[0].url).toBeNull();
    expect(rows[0].logo_filename).toBeNull();
  });

  it('keeps the first of two rows sharing a company code and flags the duplicate', () => {
    const dup = [v1[0], { ...v1[0], name: 'ชื่อซ้ำ' }];
    const { rows, problems } = toSeedRows(dup, {}, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('บริษัท ซีดีจี กรุ๊ป จำกัด');
    expect(problems.some((p) => p.kind === 'duplicate-code' && p.code === 'C01')).toBe(true);
  });

  it('skips a row with no code or no name, and flags it', () => {
    const { rows, problems } = toSeedRows([{ code: '', name: 'ไม่มีรหัส' }, { code: 'C02', name: '' }], {}, new Set());
    expect(rows).toHaveLength(0);
    expect(problems.filter((p) => p.kind === 'incomplete-record')).toHaveLength(2);
  });

  it('flags an unresolvable province instead of defaulting it to Bangkok', () => {
    const { rows, problems } = toSeedRows([{ code: 'C99', name: 'บ. ไร้จังหวัด', address: 'ไม่มีจังหวัดในที่อยู่' }], {}, new Set());
    expect(rows).toHaveLength(0);
    expect(problems.some((p) => p.kind === 'no-province' && p.code === 'C99')).toBe(true);
  });

  it('reports registry codes that V1 does not carry, without emitting them as rows', () => {
    // C19 and C88: in the registry, never on the V1 page. V1 wins, but say so out loud.
    const { rows, problems } = toSeedRows(v1, {}, new Set(['C01', 'C09', 'C19', 'C88']));
    expect(rows).toHaveLength(2);
    const missing = problems.filter((p) => p.kind === 'registry-only');
    expect(missing.map((p) => p.code).sort()).toEqual(['C19', 'C88']);
  });
});

describe('parseRegistryCodes', () => {
  const csv = [
    'ทะเบียนรายชื่อสถานประกอบการ...',
    'Last updated 13/01/2568',
    '',
    'Code,ชื่อสถานประกอบการ (ภาษาไทย),ที่ตั้ง',
    'C01,บริษัท ซีดีจี กรุ๊ป จำกัด,202 ถนนนางลิ้นจี่ กรุงเทพมหานคร 10120',
    'C88,บริษัท ร่วมเจริญพัฒนา จำกัด (มหาชน),"บ้านเลขที่ 99, 25/18-20 หมู่ที่ 4 จ.นนทบุรี 11120"',
  ].join('\n');

  it('skips the 4 preamble rows and returns the set of registry codes', () => {
    expect(parseRegistryCodes(csv)).toEqual(new Set(['C01', 'C88']));
  });

  it('handles a quoted field containing a comma without splitting the row', () => {
    // C88's address has a comma inside quotes; split(',') would lose the company.
    expect(parseRegistryCodes(csv).has('C88')).toBe(true);
  });
});
