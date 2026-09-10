import { sql } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { people, relationships, members, profilePrivacy, events } from '../db/schema';
import { validateSeed } from './validate';

export function assertDevelopmentReset(url: string, environment: string | undefined) {
  const target = new URL(url);
  if (environment !== 'development' || !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
      !target.pathname.endsWith('_dev')) throw new Error('Reset requires NODE_ENV=development and a local database ending in _dev');
}
export async function importSeed(db: Database, files: Parameters<typeof validateSeed>[0], source: string, reset = false) {
  const report = validateSeed(files);
  if (report.errors.length) throw new Error('Seed validation failed');
  if (!source.trim()) throw new Error('SEED_SOURCE is required');
  await db.transaction(async tx => {
    // Serialize initialization and exclude concurrent application writes while checking emptiness.
    await tx.execute(sql`LOCK TABLE people, members, relationships, profile_privacy, events IN ACCESS EXCLUSIVE MODE`);
    if (reset) {
      await tx.delete(events); await tx.delete(relationships); await tx.delete(profilePrivacy);
      await tx.update(people).set({ createdByMemberId: null });
      await tx.delete(members); await tx.delete(people);
    }
    for (const table of [people, members, relationships, profilePrivacy, events]) {
      if ((await tx.select().from(table).limit(1)).length) throw new Error('Database is not empty; seed import refuses to overwrite live data');
    }
    // Insert row-wise to avoid parameter limits for locally maintained datasets.
    for (const p of report.data.people) {
      await tx.insert(people).values({ id: p.person_id, displayName: p.display_name, birthDate: p.birth_date || null,
        isLiving: p.is_living === '' ? null : p.is_living === 'true', nickname: p.nickname || null, notes: p.notes || null });
      await tx.insert(profilePrivacy).values({ personId: p.person_id });
    }
    for (const r of report.data.relationships) await tx.insert(relationships).values({
      id: r.relationship_id, fromPersonId: r.from_person_id, toPersonId: r.to_person_id,
      relationshipType: r.relationship_type, status: 'SEEDED', seedSource: source, notes: r.notes || null,
    });
    for (const m of report.data.members) await tx.insert(members).values({
      id: m.member_key, displayName: m.display_name, email: m.email, linkedPersonId: m.person_id || null,
      onboardingState: m.onboarding_state === 'PRELINKED' ? 'PRELINKED' : 'UNCLAIMED',
      // Prelinking identifies the intended Person; it does not claim a login/session happened.
      status: 'INVITED', joinedAt: null,
    });
  });
  return { people: report.data.people.length, relationships: report.data.relationships.length,
    members: report.data.members.length, components: report.components, warnings: report.warnings.length, errors: 0 };
}
