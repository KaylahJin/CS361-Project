import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import type { Company } from '../types/company';

const { getCompaniesMock } = vi.hoisted(() => ({
  getCompaniesMock: vi.fn(),
}));

vi.mock('../data/companyApi', async () => {
  const actual = await vi.importActual<typeof import('../data/companyApi')>('../data/companyApi');
  return { ...actual, getCompanies: getCompaniesMock };
});

import { CompanyApiError } from '../data/companyApi';
import { Employers } from './Employers';

const SAMPLE_COMPANIES: Company[] = [
  {
    company_id: 'C01',
    name: 'บริษัท ซีดีจี กรุ๊ป จำกัด',
    short_name: 'CDG Group',
    province: 'กรุงเทพมหานคร',
    location: 'ยานนาวา กรุงเทพมหานคร',
    logo_filename: 'cdg.png',
    url: 'https://www.cdg.co.th',
  },
  {
    company_id: 'C02',
    name: 'บริษัท เอ็กซ์วายแซด เทค จำกัด',
    short_name: 'XYZ',
    province: 'กรุงเทพมหานคร',
    location: 'ปทุมวัน กรุงเทพมหานคร',
    logo_filename: 'xyz.png',
    url: 'https://xyz.example.com',
  },
  {
    company_id: 'C03',
    name: 'บริษัท บูรพา ซอฟต์แวร์ จำกัด',
    short_name: 'Burapha',
    province: 'ชลบุรี',
    location: 'ศรีราชา ชลบุรี',
    logo_filename: 'burapha.png',
    url: '',
  },
];

describe('Employers Critical Path Optimization (#240)', () => {
  beforeEach(() => {
    getCompaniesMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads companies with a single GET /companies request on initial mount and builds province counts', async () => {
    getCompaniesMock.mockResolvedValueOnce(SAMPLE_COMPANIES);
    render(<Employers onViewPositions={vi.fn()} />);

    expect(
      await screen.findByText('3 companies partner with us for cooperative education!')
    ).toBeInTheDocument();
    expect(getCompaniesMock).toHaveBeenCalledTimes(1);
    expect(getCompaniesMock).toHaveBeenCalledWith();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('option', { name: 'กรุงเทพมหานคร (2)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ชลบุรี (1)' })).toBeInTheDocument();
  });

  it('keeps top 8 logos eager and lazy-loads offscreen logos with async decoding', async () => {
    const manyCompanies: Company[] = Array.from({ length: 12 }, (_, idx) => ({
      company_id: `C${String(idx + 1).padStart(2, '0')}`,
      name: `บริษัท ทดสอบ ${idx + 1}`,
      province: 'กรุงเทพมหานคร',
      location: 'กรุงเทพมหานคร',
      logo_filename: `logo-${idx + 1}.png`,
    }));
    getCompaniesMock.mockResolvedValueOnce(manyCompanies);

    render(<Employers onViewPositions={vi.fn()} />);
    await screen.findByText('12 companies partner with us for cooperative education!');

    const imgs = screen.getAllByRole('img');
    expect(imgs).toHaveLength(12);
    expect(imgs[0]).toHaveAttribute('loading', 'eager');
    expect(imgs[7]).toHaveAttribute('loading', 'eager');
    expect(imgs[8]).toHaveAttribute('loading', 'lazy');
    expect(imgs[11]).toHaveAttribute('loading', 'lazy');
    expect(imgs[0]).toHaveAttribute('decoding', 'async');
  });

  it('filters by province while preserving unfiltered province counts', async () => {
    getCompaniesMock
      .mockResolvedValueOnce(SAMPLE_COMPANIES)
      .mockResolvedValueOnce([SAMPLE_COMPANIES[2]]);

    render(<Employers onViewPositions={vi.fn()} />);
    await screen.findByText('3 companies partner with us for cooperative education!');

    fireEvent.change(screen.getByRole('combobox', { name: 'กรองตามจังหวัด' }), {
      target: { value: 'ชลบุรี' },
    });

    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(1));
    expect(screen.getByText('บริษัท บูรพา ซอฟต์แวร์ จำกัด')).toBeInTheDocument();
    expect(getCompaniesMock).toHaveBeenCalledTimes(2);
    expect(getCompaniesMock).toHaveBeenLastCalledWith(
      { search: undefined, province: 'ชลบุรี' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(screen.getByRole('option', { name: 'กรุงเทพมหานคร (2)' })).toBeInTheDocument();
  });

  it('supports search, combined search + province filter, and cached restore on clear', async () => {
    vi.useFakeTimers();
    getCompaniesMock
      .mockResolvedValueOnce(SAMPLE_COMPANIES)
      .mockResolvedValueOnce([SAMPLE_COMPANIES[0]])
      .mockResolvedValueOnce([SAMPLE_COMPANIES[0]])
      .mockResolvedValueOnce([SAMPLE_COMPANIES[0], SAMPLE_COMPANIES[1]]);

    render(<Employers onViewPositions={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });

    const searchInput = screen.getByRole('textbox', { name: 'ค้นหาด้วยชื่อสถานประกอบการ' });
    const provinceSelect = screen.getByRole('combobox', { name: 'กรองตามจังหวัด' });

    fireEvent.change(searchInput, { target: { value: 'CDG' } });
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); });
    expect(getCompaniesMock).toHaveBeenLastCalledWith(
      { search: 'CDG', province: undefined },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    fireEvent.change(provinceSelect, { target: { value: 'กรุงเทพมหานคร' } });
    await act(async () => { await Promise.resolve(); });
    expect(getCompaniesMock).toHaveBeenLastCalledWith(
      { search: 'CDG', province: 'กรุงเทพมหานคร' },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    fireEvent.click(screen.getByRole('button', { name: 'ล้างคำค้นหา' }));
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); });
    expect(screen.getAllByRole('article')).toHaveLength(2);

    // Clearing province returns to cached unfiltered list with zero extra requests
    fireEvent.change(provinceSelect, { target: { value: '' } });
    await act(async () => { await Promise.resolve(); });
    expect(getCompaniesMock).toHaveBeenCalledTimes(4);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });

  it('aborts superseded filtered requests when province filter changes rapidly', async () => {
    let firstSignal: AbortSignal | undefined;
    let resolveFirst!: (rows: Company[]) => void;

    getCompaniesMock
      .mockResolvedValueOnce(SAMPLE_COMPANIES)
      .mockImplementationOnce((_p, opts) => {
        firstSignal = opts?.signal;
        return new Promise<Company[]>((resolve) => { resolveFirst = resolve; });
      })
      .mockResolvedValueOnce([SAMPLE_COMPANIES[2]]);

    render(<Employers onViewPositions={vi.fn()} />);
    await screen.findByText('3 companies partner with us for cooperative education!');

    const provinceSelect = screen.getByRole('combobox', { name: 'กรองตามจังหวัด' });
    fireEvent.change(provinceSelect, { target: { value: 'กรุงเทพมหานคร' } });
    await waitFor(() => expect(getCompaniesMock).toHaveBeenCalledTimes(2));

    fireEvent.change(provinceSelect, { target: { value: 'ชลบุรี' } });
    await waitFor(() => expect(screen.getByText('บริษัท บูรพา ซอฟต์แวร์ จำกัด')).toBeInTheDocument());
    expect(firstSignal?.aborted).toBe(true);

    resolveFirst([SAMPLE_COMPANIES[0], SAMPLE_COMPANIES[1]]);
    await Promise.resolve();
    expect(screen.getAllByRole('article')).toHaveLength(1);
  });

  it('shows error on initial failure and recovers cleanly without poisoning cache', async () => {
    vi.useFakeTimers();
    getCompaniesMock
      .mockRejectedValueOnce(new CompanyApiError('Server Error', 500))
      .mockResolvedValueOnce(SAMPLE_COMPANIES)
      .mockResolvedValueOnce([SAMPLE_COMPANIES[0]]);

    render(<Employers onViewPositions={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole('alert')).toHaveTextContent('โหลดข้อมูลไม่สำเร็จ (500)');

    fireEvent.change(screen.getByRole('textbox', { name: 'ค้นหาด้วยชื่อสถานประกอบการ' }), {
      target: { value: 'CDG' },
    });
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'ล้างคำค้นหา' }));
    await act(async () => { vi.advanceTimersByTime(300); await Promise.resolve(); });
    expect(getCompaniesMock).toHaveBeenCalledTimes(3);
    expect(screen.getAllByRole('article')).toHaveLength(3);
  });
});
