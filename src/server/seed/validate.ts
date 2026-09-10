import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { canonicalize, relationshipTypes } from '../../domain/relationships';

const required = z.string().trim().min(1);
const blank = z.string().default('');
const personSchema = z.object({
  person_id: required, display_name: required,
  birth_date: blank.refine(v => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && Number(v.slice(0, 4)) > 0 &&
    !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v), 'Invalid calendar date'),
  is_living: z.enum(['', 'true', 'false']).default(''), nickname: blank, notes: blank,
}).strict();
const relationshipSchema = z.object({
  from_person_id: required, to_person_id: required, relationship_type: z.enum(relationshipTypes),
  relationship_id: blank, notes: blank,
}).strict();
const memberSchema = z.object({
  member_key: required, display_name: required, email: z.email().transform(v => v.toLowerCase()),
  person_id: blank, onboarding_state: z.enum(['', 'PRELINKED', 'UNCLAIMED']).default(''),
}).strict();
export type SeedPerson = z.infer<typeof personSchema>;
export type SeedRelationship = z.infer<typeof relationshipSchema>;
export type SeedMember = z.infer<typeof memberSchema>;
export interface SeedData { people: SeedPerson[]; relationships: SeedRelationship[]; members: SeedMember[] }
export interface Issue { file: string; row?: number; code: string }
export interface ValidationReport { data: SeedData; errors: Issue[]; warnings: Issue[]; components: number }

export function validateSeed(files: { people: string; relationships: string; members?: string }): ValidationReport {
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
  const people = rows('people.csv', files.people, personSchema, ['person_id', 'display_name']);
  const relationships = rows('relationships.csv', files.relationships, relationshipSchema, ['from_person_id', 'to_person_id', 'relationship_type']);
  const members = files.members === undefined ? [] : rows('members.csv', files.members, memberSchema, ['member_key', 'display_name', 'email']);
  function unique(values: string[], file: string, code: string) {
    const seen = new Set<string>();
    for (const value of values) { if (seen.has(value)) errors.push({ file, code }); seen.add(value); }
  }
  unique(people.map(p => p.person_id), 'people.csv', 'DUPLICATE_PERSON_ID');
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
    m.onboarding_state ||= m.person_id ? 'PRELINKED' : 'UNCLAIMED';
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
  return { data: { people, relationships, members }, errors, warnings, components };
}
