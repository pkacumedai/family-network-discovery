import { describe, expect, it } from 'vitest';
import { authConfiguration } from '../../src/server/auth/config';
import { validateSeed } from '../../src/server/seed/validate';
const env: NodeJS.ProcessEnv = { NODE_ENV: 'development', BETTER_AUTH_SECRET: 'a-test-secret-with-at-least-32-characters', BETTER_AUTH_URL: 'http://127.0.0.1:3000', MAIL_TRANSPORT: 'mailpit' };
describe('auth deployment boundaries', () => {
  it('accepts an isolated local transport', () => { expect(authConfiguration(env).production).toBe(false); });
  it('rejects missing secrets', () => { expect(() => authConfiguration({ ...env, BETTER_AUTH_SECRET: '' })).toThrow(); });
  it('rejects local mail and HTTP in production', () => { expect(() => authConfiguration({ ...env, NODE_ENV: 'production' })).toThrow(); });
  it('requires explicit production SMTP configuration', () => { expect(() => authConfiguration({ ...env, NODE_ENV: 'production', MAIL_TRANSPORT: 'smtp', BETTER_AUTH_URL: 'https://family.example' })).toThrow(); });
});
describe('Family admission seed validation', () => {
  const files = { families: 'family_id,name\nA,One\nB,Two\n', people: 'family_id,person_id,display_name\nA,P1,One\nB,P2,Two\n', relationships: 'family_id,from_person_id,to_person_id,relationship_type\n', admissions: 'admission_id,family_id,email,role,status\nAD1,A,one@example.com,MEMBER,ACTIVE\n' };
  it('accepts one email admitted independently to multiple Families', () => { expect(validateSeed({ ...files, admissions: files.admissions + 'AD2,B,one@example.com,ADMIN,ACTIVE\n' }).errors).toEqual([]); });
  it('rejects unknown Families', () => { expect(validateSeed({ ...files, admissions: files.admissions + 'AD2,Z,two@example.com,MEMBER,ACTIVE\n' }).errors).toContainEqual({ file: 'families.csv', code: 'UNKNOWN_FAMILY' }); });
  it('rejects duplicate admissions and normalized email collisions', () => { expect(validateSeed({ ...files, admissions: files.admissions + 'AD2,A,ONE@example.com,MEMBER,ACTIVE\n' }).errors.length).toBeGreaterThan(0); });
  it('rejects cross-Family Relationships', () => { expect(validateSeed({ ...files, relationships: files.relationships + 'A,P1,P2,PARENT_OF\n' }).errors).toContainEqual({ file: 'relationships.csv', code: 'CROSS_FAMILY_RELATIONSHIP' }); });
  it('rejects mismatched historical claim hints', () => { expect(validateSeed({ ...files, members: 'member_key,display_name,email,person_id\nM1,One,one@example.com,P2\n' }).errors).toContainEqual({ file: 'members.csv', code: 'MEMBERSHIP_FAMILY_MISMATCH' }); });
});
