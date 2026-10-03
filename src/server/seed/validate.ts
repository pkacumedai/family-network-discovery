import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { canonicalize, relationshipTypes } from '../../domain/relationships';

const required = z.string().trim().min(1);
const blank = z.string().default('');
const personSchema = z.object({
  person_id: required, display_name: required, family_id: z.string().default('sample-family'),
  birth_date: blank.refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) > 0 &&
    !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), 'Invalid calendar date'),
  is_living: z.enum(['', 'true', 'false']).default(''), nickname: blank, notes: blank,
}).strict();
const relationshipSchema = z.object({
  family_id: z.string().default('sample-family'), from_person_id: required, to_person_id: required, relationship_type: z.enum(relationshipTypes),
  relationship_id: blank, notes: blank,
}).strict();
const memberSchema = z.object({
  member_key: required, display_name: required, email: z.email().transform(v => v.toLowerCase()),
  person_id: blank, onboarding_state: z.enum(['', 'PRELINKED', 'UNCLAIMED']).default(''),
}).strict();
export type SeedPerson = z.infer<typeof personSchema>;
export type SeedRelationship = z.infer<typeof relationshipSchema>;
export type SeedMember = z.infer<typeof memberSchema>;
const familySchema = z.object({ family_id: required, name: required }).strict();
const admissionSchema = z.object({ admission_id: required, family_id: required, email: z.email().transform(v => v.toLowerCase()), role: z.enum(['MEMBER', 'ADMIN']), status: z.enum(['ACTIVE', 'REVOKED']), expected_person_id: z.string().trim().optional() }).strict();
export interface SeedData { families: z.infer<typeof familySchema>[]; admissions: z.infer<typeof admissionSchema>[]; people: SeedPerson[]; relationships: SeedRelationship[]; members: SeedMember[] }
export interface Issue { file: string; row?: number; code: string }
export interface ValidationReport { data: SeedData; errors: Issue[]; warnings: Issue[]; components: number }

export function validateSeed(files: { people: string; relationships: string; members?: string; families?: string; admissions?: string }, admissionPeople?: readonly Pick<SeedPerson, 'person_id' | 'family_id'>[]): ValidationReport {
  const errors: Issue[] = [], warnings: Issue[] = [];
  function rows<T>(file: string, input: string, schema: z.ZodType<T>, requiredHeaders: string[]): T[] {
    try {
      const records = parse(input, { bom: true, skip_empty_lines: true, trim: true }) as string[][];
      const headers = records.shift() ?? [];
      if (new Set(headers).size !== headers.length || requiredHeaders.some(h => !headers.includes(h))) {
        errors.push({ file, code: 'INVALID_HEADERS' }); return [];
      }
      return records.flatMap((record, i) => {
        if (record.length !== headers.length) { errors.push({ file, row: i + 2, code: 'COLUMN_COUNT' }); return []; }
        const result = schema.safeParse(Object.fromEntries(headers.map((h, j) => [h, record[j]])));
        if (!result.success) { errors.push({ file, row: i + 2, code: 'INVALID_FIELDS' }); return []; }
        return [result.data];
      });
    } catch { errors.push({ file, code: 'INVALID_CSV' }); return []; }
  }
  const families = files.families === undefined ? [{ family_id: 'sample-family', name: 'Sample Family' }] : rows('families.csv', files.families, familySchema, ['family_id', 'name']);
  const admissions = files.admissions === undefined ? [] : rows('admissions.csv', files.admissions, admissionSchema, ['admission_id', 'family_id', 'email', 'role', 'status']);
  const people = rows('people.csv', files.people, personSchema, ['person_id', 'display_name']);
  const relationships = rows('relationships.csv', files.relationships, relationshipSchema, ['from_person_id', 'to_person_id', 'relationship_type']);
  const members = files.members === undefined ? [] : rows('members.csv', files.members, memberSchema, ['member_key', 'display_name', 'email']);
  function unique(values: string[], file: string, code: string) {
    const seen = new Set<string>();
    for (const value of values) { if (seen.has(value)) errors.push({ file, code }); seen.add(value); }
  }
  unique(people.map(p => p.person_id), 'people.csv', 'DUPLICATE_PERSON_ID');
  unique(families.map(f => f.family_id), 'families.csv', 'DUPLICATE_FAMILY');
  unique(admissions.map(a => a.admission_id), 'admissions.csv', 'DUPLICATE_ADMISSION');
  unique(admissions.map(a => JSON.stringify([a.family_id, a.email])), 'admissions.csv', 'DUPLICATE_ADMISSION');
  const familyIds = new Set(families.map(f => f.family_id));
  for (const row of [...people, ...relationships, ...admissions]) if (!familyIds.has(row.family_id)) errors.push({ file: 'families.csv', code: 'UNKNOWN_FAMILY' });
  const personFamilies = new Map(people.map(p => [p.person_id, p.family_id]));
  const admissionPersonFamilies = new Map((admissionPeople ?? people).map(p => [p.person_id, p.family_id]));
  for (const a of admissions) {
    if (!a.expected_person_id) continue;
    if (!admissionPersonFamilies.has(a.expected_person_id)) errors.push({ file: 'admissions.csv', code: 'UNKNOWN_EXPECTED_PERSON' });
    else if (admissionPersonFamilies.get(a.expected_person_id) !== a.family_id) errors.push({ file: 'admissions.csv', code: 'CROSS_FAMILY_EXPECTED_PERSON' });
  }
  for (const r of relationships) if (personFamilies.get(r.from_person_id) !== r.family_id || personFamilies.get(r.to_person_id) !== r.family_id) errors.push({ file: 'relationships.csv', code: 'CROSS_FAMILY_RELATIONSHIP' });
  const ids = new Set(people.map(p => p.person_id));
  const adjacent = new Map(people.map(p => [p.person_id, new Set<string>()]));
  const parents = new Map(people.map(p => [p.person_id, new Set<string>()]));
  const keys: string[] = [];
  for (const r of relationships) {
    if (!ids.has(r.from_person_id) || !ids.has(r.to_person_id)) errors.push({ file: 'relationships.csv', code: 'UNKNOWN_PERSON' });
    if (r.from_person_id === r.to_person_id) { errors.push({ file: 'relationships.csv', code: 'SELF_RELATIONSHIP' }); continue; }
    const c = canonicalize(r.from_person_id, r.to_person_id, r.relationship_type);
    r.from_person_id = c.from; r.to_person_id = c.to;
    const key = JSON.stringify([c.type, c.from, c.to]); keys.push(key);
    r.relationship_id ||= `seed-${createHash('sha256').update(key).digest('hex')}`;
    adjacent.get(c.from)?.add(c.to); adjacent.get(c.to)?.add(c.from);
    if (c.type === 'PARENT_OF') parents.get(c.to)?.add(c.from);
  }
  unique(keys, 'relationships.csv', 'DUPLICATE_RELATIONSHIP');
  unique(relationships.map(r => r.relationship_id), 'relationships.csv', 'DUPLICATE_RELATIONSHIP_ID');
  unique(members.map(m => m.member_key), 'members.csv', 'DUPLICATE_MEMBER_KEY');
  unique(members.map(m => m.email), 'members.csv', 'DUPLICATE_LOGIN');
  unique(members.map(m => m.person_id).filter(Boolean), 'members.csv', 'DUPLICATE_CLAIM');
  for (const m of members) {
    const admission = admissions.find(a => a.admission_id === m.member_key);
    if (admission && (admission.email !== m.email || admission.family_id !== 'sample-family')) errors.push({ file: 'admissions.csv', code: 'LEGACY_ADMISSION_MISMATCH' });
    if (!familyIds.has('sample-family')) errors.push({ file: 'members.csv', code: 'UNKNOWN_FAMILY' });
    m.onboarding_state ||= m.person_id ? 'PRELINKED' : 'UNCLAIMED';
    if (m.person_id && personFamilies.has(m.person_id) && personFamilies.get(m.person_id) !== 'sample-family') errors.push({ file: 'members.csv', code: 'MEMBERSHIP_FAMILY_MISMATCH' });
    if (m.person_id && !ids.has(m.person_id)) errors.push({ file: 'members.csv', code: 'UNKNOWN_PERSON' });
    if ((m.onboarding_state === 'PRELINKED') !== Boolean(m.person_id)) errors.push({ file: 'members.csv', code: 'ONBOARDING_LINK_MISMATCH' });
  }
  for (const p of people) {
    if (!p.birth_date) warnings.push({ file: 'people.csv', code: 'MISSING_BIRTH_DATE' });
    if (!adjacent.get(p.person_id)?.size) warnings.push({ file: 'people.csv', code: 'ISOLATED_PERSON' });
    if ((parents.get(p.person_id)?.size ?? 0) > 2) warnings.push({ file: 'people.csv', code: 'MANY_PARENTS' });
  }
  for (const r of relationships) {
    if (r.relationship_type === 'SIBLING_OF' && [...(parents.get(r.from_person_id) ?? [])].some(p => parents.get(r.to_person_id)?.has(p))) {
      warnings.push({ file: 'relationships.csv', code: 'REDUNDANT_SIBLING' });
    }
  }
  const visited = new Set<string>(); let components = 0;
  for (const id of ids) {
    if (visited.has(id)) continue;
    components++;
    const pending = [id];
    while (pending.length) {
      const next = pending.pop()!;
      if (visited.has(next) || !ids.has(next)) continue;
      visited.add(next); pending.push(...(adjacent.get(next) ?? []));
    }
  }
  if (components > 1) warnings.push({ file: 'people.csv', code: 'DISCONNECTED_COMPONENTS' });
  return { data: { people, relationships, members, families, admissions }, errors, warnings, components };
}
