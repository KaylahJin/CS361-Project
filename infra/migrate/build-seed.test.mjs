import { describe, it, expect } from 'vitest';
import { extractProvince, parseV1Enrichment, sqlStr } from './build-seed.mjs';

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

describe('parseV1Enrichment', () => {
  // Shaped exactly like the EMPLOYERS_DATA array literal in src/pages/Employers.tsx:
  // 2-space indented `{`, 4-space indented fields, `  },` closer, final `];` at col 0.
  const fixture = `export const EMPLOYERS_DATA: Employer[] = [
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
    id: 'C02',
    code: 'C02',
    name: 'ศูนย์เทคโนโลยีอิเล็กทรอนิกส์และคอมพิวเตอร์แห่งชาติ (NECTEC)',
    shortName: 'NECTEC',
    address: 'ศูนย์เทคโนโลยีอิเล็กทรอนิกส์และคอมพิวเตอร์แห่งชาติ (NECTEC) 112 ถนนพหลโยธิน',
    logoFilename: 'nectec.png',
    url: 'https://www.nectec.or.th/',
  },
];
`;

  it('maps each code to its shortName/logoFilename/url', () => {
    const map = parseV1Enrichment(fixture);
    expect(map.size).toBe(2);
    expect(map.get('C01')).toEqual({
      shortName: 'CDG Group',
      logoFilename: 'cdg.png',
      url: 'https://www.cdg.co.th/join-us/',
    });
    expect(map.get('C02')).toEqual({
      shortName: 'NECTEC',
      logoFilename: 'nectec.png',
      url: 'https://www.nectec.or.th/',
    });
  });

  it('returns an empty map when the source has no `code: \'...\'` entries', () => {
    expect(parseV1Enrichment('export const EMPLOYERS_DATA: Employer[] = [];').size).toBe(0);
  });
});
