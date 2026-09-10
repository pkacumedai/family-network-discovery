export const relationshipTypes = ['PARENT_OF', 'SPOUSE_OF', 'SIBLING_OF'] as const;
export type RelationshipType = (typeof relationshipTypes)[number];
export function canonicalize(from: string, to: string, type: RelationshipType) {
  if (from === to) throw new Error('Self-relationships are not allowed');
  if (type !== 'PARENT_OF' && from > to) return { from: to, to: from, type };
  return { from, to, type };
}
export function inverseType(type: RelationshipType): RelationshipType | 'CHILD_OF' {
  return type === 'PARENT_OF' ? 'CHILD_OF' : type;
}
