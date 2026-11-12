
import { describe, it, expect } from 'vitest';
import { generatePositionsSql } from './build-positions-seed.mjs';

describe('generatePositionsSql', () => {
  const positions = [
    {
      position_id: 'POS001',
      title: 'Backend Developer',
      company_label: 'Test Company',
      registry_candidate_codes: ['C01'],
      duration: '6 months',
      allowance: '5000 THB/month',
      category: 'Software Development',
      qualifications: 'Basic programming skills',
      work_location: 'Bangkok',
      work_mode: 'Hybrid',
      application_deadline: '2026-12-31',
      application_url: 'https://example.com/apply',
      current_status: 'open',
      open_now: true,
      source_url: 'https://example.com',
    },
  ];

  it('generates an INSERT statement for valid positions', () => {
    const result = generatePositionsSql(positions);

    expect(result.sql).toContain('INSERT INTO positions');
    expect(result.sql).toContain("'POS001'");
    expect(result.sql).toContain("'Backend Developer'");
    expect(result.count).toBe(1);
  });

  it('does not overwrite existing positions when seed runs again', () => {
    const result = generatePositionsSql(positions);

    expect(result.sql).toContain(
      'ON CONFLICT (position_id) DO NOTHING'
    );
    expect(result.sql).not.toContain('DO UPDATE SET');
  });

  it('preserves the source status in the generated seed', () => {
    const result = generatePositionsSql(positions);

    expect(result.sql).toContain("'open'");
    expect(result.sql).not.toContain('status = EXCLUDED.status');
  });

  it('skips positions without a valid company reference', () => {
    const invalidPositions = [
      {
        ...positions[0],
        position_id: 'POS002',
        registry_candidate_codes: [],
        confirmed_registry_company_id: null,
      },
    ];

    const result = generatePositionsSql(invalidPositions);

    expect(result.count).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toContain('POS002');
    expect(result.sql).not.toContain("'POS002'");
  });

  it('generates multiple valid positions', () => {
    const multiplePositions = [
      ...positions,
      {
        ...positions[0],
        position_id: 'POS002',
        title: 'Frontend Developer',
      },
    ];

    const result = generatePositionsSql(multiplePositions);

    expect(result.count).toBe(2);
    expect(result.sql).toContain("'POS001'");
    expect(result.sql).toContain("'POS002'");
  });

  it('maps position categories to the expected database values', () => {
    const result = generatePositionsSql(positions);

    expect(result.sql).toContain("'software_development'");
  });

  it('converts invalid or missing application deadlines to NULL', () => {
    const invalidDatePositions = [
      {
        ...positions[0],
        application_deadline: 'not-a-date',
      },
    ];

    const result = generatePositionsSql(invalidDatePositions);

    expect(result.sql).toContain('NULL');
    expect(result.sql).not.toContain("'not-a-date'");
  });
});
