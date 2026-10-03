import { and, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { admissions, families, memberships, people } from '../db/schema';
import { validateSeed } from './validate';

// Explicit administrative import, not a participant-facing application operation.
export async function importAdmissions(db: Database, csv: string) {
  return db.transaction(async tx => {
    await tx.execute(sql`LOCK TABLE family_admissions IN SHARE ROW EXCLUSIVE MODE`);
    const known = await tx.select({ id: families.id }).from(families);
    const knownPeople = await tx.select({ person_id: people.id, family_id: people.familyId }).from(people);
    const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const report = validateSeed({ people: 'person_id,display_name\n', relationships: 'from_person_id,to_person_id,relationship_type\n',
      families: 'family_id,name\n' + known.map(f => `${quote(f.id)},Family`).join('\n'), admissions: csv }, knownPeople);
    if (report.errors.length) throw new Error('Admission validation failed');
    for (const a of report.data.admissions) {
      const [old] = await tx.select().from(admissions).where(eq(admissions.id, a.admission_id)).for('update');
      if (old && (old.email !== a.email || old.familyId !== a.family_id)) throw new Error('Admission identity cannot be changed');
      if (old?.status === 'REVOKED' && a.status === 'ACTIVE') throw new Error('Revoked admission cannot be reactivated by import');
      // An older CSV without the optional column must not erase an existing constraint.
      const expectedPersonId = a.expected_person_id === undefined ? old?.expectedPersonId ?? null : a.expected_person_id || null;
      const linked = await tx.select({ personId: memberships.personId }).from(memberships).where(eq(memberships.admissionId, a.admission_id));
      if (expectedPersonId && linked.some(m => m.personId && m.personId !== expectedPersonId)) {
        throw new Error('Expected Person conflicts with an existing claim; import cannot correct identity');
      }
      await tx.insert(admissions).values({ id: a.admission_id, email: a.email, familyId: a.family_id, role: a.role, status: a.status, expectedPersonId })
        .onConflictDoUpdate({ target: admissions.id, set: { status: a.status, role: a.role, expectedPersonId, updatedAt: new Date() } });
      await tx.update(memberships).set({ role: a.role, updatedAt: new Date() }).where(and(eq(memberships.admissionId, a.admission_id), ne(memberships.role, a.role)));
      if (a.status === 'REVOKED') await tx.update(memberships).set({ status: 'REVOKED', updatedAt: new Date() }).where(and(eq(memberships.admissionId, a.admission_id), eq(memberships.familyId, a.family_id)));
    }
    return report.data.admissions.length;
  });
}
