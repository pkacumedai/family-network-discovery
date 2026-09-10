import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateSeed } from '../../src/server/seed/validate';
import { assertDevelopmentReset } from '../../src/server/seed/import';
import { canonicalize, inverseType } from '../../src/domain/relationships';
const base = {
  people: 'person_id,display_name\nP1,One\nP2,Two\nP3,Three\n',
  relationships: 'from_person_id,to_person_id,relationship_type\n',
};
const codes = (files: Parameters<typeof validateSeed>[0]) => validateSeed(files).errors.map(e => e.code);
describe('seed validation', () => {
  it('reads synthetic CSVs and reports disconnected components without failing', () => {
    const read = (name: string) => readFileSync(`seed/fixtures/${name}.csv`, 'utf8');
    const report = validateSeed({ people: read('people'), relationships: read('relationships'), members: read('members') });
    expect(report.errors).toEqual([]); expect(report.components).toBe(2);
    expect(report.data.members[0].onboarding_state).toBe('PRELINKED');
    expect(report.warnings.map(w => w.code)).toContain('DISCONNECTED_COMPONENTS');
  });
  it('supports BOM, quoted commas/newlines, optional columns and absent members', () => {
    const report = validateSeed({ ...base, people: '\uFEFFperson_id,display_name\nP1,"One,\nExample"\n' });
    expect(report.errors).toEqual([]); expect(report.data.people[0].display_name).toBe('One,\nExample');
  });
  it.each(['2023-02-29', '2024-02-30', '0000-01-01', '24-01-01', 'nonsense'])('rejects invalid date %s', date => {
    expect(codes({ ...base, people: `person_id,display_name,birth_date\nP1,One,${date}\n` })).toContain('INVALID_FIELDS');
  });
  it('accepts real leap days and unknown living state', () => {
    expect(codes({ ...base, people: 'person_id,display_name,birth_date\nP1,One,2024-02-29\n' })).toEqual([]);
  });
  it.each([
    ['person_id,display_name\nP1,One\nP1,Two\n', 'DUPLICATE_PERSON_ID'],
    ['person_id,display_name\n,One\n', 'INVALID_FIELDS'],
    ['person_id,display_name\nP1,\n', 'INVALID_FIELDS'],
    ['person_id,display_name,is_living\nP1,One,yes\n', 'INVALID_FIELDS'],
    ['person_id,person_id\nP1,P2\n', 'INVALID_HEADERS'],
    ['person_id,display_name\nP1,"unfinished', 'INVALID_CSV'],
  ])('rejects invalid people input', (people, code) => expect(codes({ ...base, people })).toContain(code));
  it.each([
    ['P1,P1,PARENT_OF', 'SELF_RELATIONSHIP'], ['P1,P4,PARENT_OF', 'UNKNOWN_PERSON'],
    ['P1,P2,CHILD_OF', 'INVALID_FIELDS'], ['P1,P2,COUSIN_OF', 'INVALID_FIELDS'],
    ['P1,P2,PARENT_OF\nP1,P2,PARENT_OF', 'DUPLICATE_RELATIONSHIP'],
    ['P1,P2,SPOUSE_OF\nP2,P1,SPOUSE_OF', 'DUPLICATE_RELATIONSHIP'],
    ['P1,P2,SIBLING_OF\nP2,P1,SIBLING_OF', 'DUPLICATE_RELATIONSHIP'],
  ])('rejects invalid relationships', (rows, code) => {
    expect(codes({ ...base, relationships: base.relationships + rows })).toContain(code);
  });
  it('preserves explicit cross-branch paths, multiple spouses and directional parents', () => {
    const report = validateSeed({ ...base, relationships: base.relationships + 'P1,P2,SPOUSE_OF\nP1,P3,SPOUSE_OF\nP2,P3,PARENT_OF\nP3,P2,PARENT_OF' });
    expect(report.errors).toEqual([]); expect(report.data.relationships).toHaveLength(4);
  });
  it('uses stable generated IDs independent of row order and symmetric direction', () => {
    const a = validateSeed({ ...base, relationships: base.relationships + 'P1,P2,SIBLING_OF' });
    const b = validateSeed({ ...base, relationships: base.relationships + 'P2,P1,SIBLING_OF' });
    expect(a.data.relationships).toEqual(b.data.relationships);
  });
  it.each([
    ['M1,One,a@example.com,P1,PRELINKED\nM1,Two,b@example.com,,UNCLAIMED', 'DUPLICATE_MEMBER_KEY'],
    ['M1,One,A@example.com,,UNCLAIMED\nM2,Two,a@example.com,,UNCLAIMED', 'DUPLICATE_LOGIN'],
    ['M1,One,a@example.com,P1,PRELINKED\nM2,Two,b@example.com,P1,PRELINKED', 'DUPLICATE_CLAIM'],
    ['M1,One,a@example.com,P4,PRELINKED', 'UNKNOWN_PERSON'],
    ['M1,One,a@example.com,,PRELINKED', 'ONBOARDING_LINK_MISMATCH'],
  ])('rejects invalid member associations', (rows, code) => {
    expect(codes({ ...base, members: 'member_key,display_name,email,person_id,onboarding_state\n' + rows })).toContain(code);
  });
  it('warns about many parents and redundant siblings', () => {
    const report = validateSeed({ people: base.people + 'P4,Four\n', relationships: base.relationships +
      'P1,P4,PARENT_OF\nP2,P4,PARENT_OF\nP3,P4,PARENT_OF\nP1,P3,PARENT_OF\nP3,P4,SIBLING_OF' });
    expect(report.errors).toEqual([]);
    expect(report.warnings.map(w => w.code)).toEqual(expect.arrayContaining(['MANY_PARENTS', 'REDUNDANT_SIBLING']));
  });
});
describe('relationship primitives', () => {
  it('derives inverse types without storing inverse records', () => {
    expect(inverseType('PARENT_OF')).toBe('CHILD_OF'); expect(inverseType('SPOUSE_OF')).toBe('SPOUSE_OF');
    expect(inverseType('SIBLING_OF')).toBe('SIBLING_OF');
  });
  it('canonicalizes symmetric endpoints only and rejects self links', () => {
    expect(canonicalize('B', 'A', 'SIBLING_OF').from).toBe('A');
    expect(canonicalize('B', 'A', 'PARENT_OF').from).toBe('B');
    expect(() => canonicalize('A', 'A', 'SPOUSE_OF')).toThrow();
  });
});
describe('reset eligibility', () => {
  it.each([
    ['postgresql://u:p@localhost/family_dev', 'production'],
    ['postgresql://u:p@remote/family_dev', 'development'],
    ['postgresql://u:p@localhost/family_pilot', 'development'],
    ['postgresql://u:p@localhost/family_dev', undefined],
  ])('rejects unsafe reset target', (url, env) => expect(() => assertDevelopmentReset(url, env)).toThrow());
  it('permits explicit local development target', () => expect(() => assertDevelopmentReset('postgresql://u:p@localhost/family_dev', 'development')).not.toThrow());
});
