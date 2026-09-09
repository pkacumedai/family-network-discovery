# Family Network Discovery App
## Milestone 1 — Seed Data Specification

**Purpose:** Define a human-maintainable method for creating the initial family graph used by the Discovery App.

## 1. Seed Philosophy

Seed data defines the starting graph.

The family steward should explicitly provide People and direct relationships.

The seed importer must never infer unsupported family relationships merely from names, dates, or apparent structure.

Derived kinship descriptions such as cousin, aunt, nephew, or grandparent shall be calculated from primitive relationships rather than entered as canonical relationships.

## 2. Seed Directory

Recommended structure:

`/seed/templates/people.csv`

`/seed/templates/relationships.csv`

`/seed/templates/members.csv`

Actual private pilot data may live in a Git-ignored directory such as:

`/seed/private/people.csv`

`/seed/private/relationships.csv`

`/seed/private/members.csv`

The repository should contain synthetic/example templates but should not expose private real-family data if the repository may become public.

## 3. People File

File:

`people.csv`

Required columns:

- person_id
- display_name

Recommended columns:

- birth_date
- is_living
- nickname
- notes

Example:

person_id,display_name,birth_date,is_living,nickname  
P001,Ravi Kini,1962-05-03,true,  
P002,Meena Kini,1965-11-14,true,  
P003,Anita Shah,1988-07-21,true,Ani

## 4. Person IDs

Use stable artificial identifiers rather than names as keys.

Recommended format:

P001  
P002  
P003

Names may change or duplicate.

Person IDs must never depend on:

- name spelling;
- birth date;
- email address.

Once assigned for a pilot dataset, avoid changing Person IDs unnecessarily.

## 5. Birth Dates

Preferred format:

YYYY-MM-DD

Example:

1965-05-03

If the exact date is unknown, leave the field blank in Milestone 1 rather than inventing a date.

Do not encode uncertainty through fake dates such as January 1.

## 6. Relationships File

File:

`relationships.csv`

Required columns:

- from_person_id
- to_person_id
- relationship_type

Optional:

- relationship_id
- notes

Supported Milestone 1 canonical relationship types:

PARENT_OF  
SPOUSE_OF  
SIBLING_OF

Example:

from_person_id,to_person_id,relationship_type  
P001,P003,PARENT_OF  
P002,P003,PARENT_OF  
P001,P002,SPOUSE_OF

## 7. Enter Direct Relationships, Not Kinship Labels

Do not enter:

GRANDFATHER_OF  
AUNT_OF  
UNCLE_OF  
COUSIN_OF  
MOTHER_IN_LAW_OF  
BROTHER_IN_LAW_OF

Instead enter the primitive relationships from which they arise.

Example:

If Anita is Ravi's sister:

Ravi SIBLING_OF Anita

If Maya is Anita's daughter:

Anita PARENT_OF Maya

The application may then derive that Ravi is Maya's uncle.

## 8. Parent/Child Direction

Always record the parent as `from_person_id`.

Example:

P001,P010,PARENT_OF

means:

P001 is a parent of P010.

Do not also enter:

P010,P001,CHILD_OF

CHILD_OF is derived.

## 9. Symmetric Relationships

SPOUSE_OF and SIBLING_OF should be entered once only.

Do not enter both:

P001,P002,SPOUSE_OF  
P002,P001,SPOUSE_OF

The importer/application shall treat the relationship as symmetric.

Likewise for siblings.

## 10. Multiple Relationship Paths Are Valid

The seed format shall permit people to be connected through multiple graph paths.

This is intentional.

Example:

A Person may be connected to another individual both through their own marriage and through relationships elsewhere in the extended family.

The importer must not assume that the graph is a strict tree.

Loops and cross-branch paths may represent valid family structure.

## 11. Marriage and Family Structure

The graph should not assume:

- only one marriage per Person;
- that spouses share children;
- that marriage implies parenthood;
- that all siblings share both parents;
- that family structure forms a single hierarchy.

Each relationship must be explicitly entered.

## 12. Members File

File:

`members.csv`

This represents people initially permitted to participate in the prototype.

Recommended fields:

- member_key
- display_name
- email
- person_id
- onboarding_state

Example:

member_key,display_name,email,person_id,onboarding_state  
M001,Ravi Kini,ravi@example.com,P001,PRELINKED  
M002,Anita Shah,anita@example.com,,UNCLAIMED

For Discovery testing, some Members may intentionally have no Person association.

This allows testing of identity search and “Add myself.”

## 13. Private Member Data

Real email addresses, dates of birth, phone numbers, or other personal data should not be committed into a public GitHub repository.

Use:

- ignored private seed files;
- environment-specific secure configuration;
- synthetic sample data in the repository.

## 14. Seed Validation

Before database import, validate:

### People

- Person ID present;
- Person ID unique;
- display name present;
- valid date format when supplied;
- valid living-state value.

### Relationships

- both Person IDs exist;
- no Person relates to themselves;
- valid relationship type;
- no duplicate relationship;
- no reverse duplicate for symmetric relationships.

### Members

- unique Member key;
- unique login identifier where applicable;
- linked Person exists when supplied;
- no Person linked to multiple Members.

## 15. Validation Warnings

Some situations should generate warnings rather than import failures.

Examples:

- Person has no relationships;
- Person has no birth date;
- Person appears to have unusually many parents;
- sibling relationship appears redundant because shared parents already imply siblinghood;
- disconnected graph component exists.

Warnings should be reviewed by the family steward but need not prevent import.

## 16. Seed Import Process

Recommended development command:

`npm run seed:validate`

followed by:

`npm run seed`

The seed operation should:

1. parse files;
2. validate schema;
3. validate graph integrity;
4. report errors/warnings;
5. clear or reset development seed state when explicitly requested;
6. import People;
7. import Relationships;
8. import initial Members;
9. report counts.

Example summary:

People imported: 47  
Relationships imported: 63  
Members imported: 12  
Disconnected components: 1  
Warnings: 3  
Errors: 0

## 17. Safety of Reset Operations

Development reset commands should be clearly differentiated from pilot/production operations.

A destructive reset shall never occur automatically against a non-development database.

## 18. Recommended Family-Seeding Method

For manually constructing the first actual family:

### Step 1
List every Person you want represented.

Assign stable Person IDs.

Do not worry initially about derived family terminology.

### Step 2
Add parent-child relationships.

These provide the strongest basis for generational layout and derived kinship.

### Step 3
Add spouse/partner relationships.

### Step 4
Add explicit sibling relationships only where useful or where parent records are absent/incomplete.

### Step 5
Review cross-branch relationships and unusual family structures.

### Step 6
Run validation.

### Step 7
Load the graph and visually inspect it.

The visualization itself is an important data-quality check.

## 19. Recommended Initial Pilot Size

There is no hard requirement, but the initial seed should be large enough to test meaningful navigation.

A useful initial family graph might contain:

- several generations;
- multiple sibling groups;
- multiple marriages;
- repeated or similar names;
- at least one cross-branch relationship;
- both Members already represented and Members intentionally absent.

The goal is representative complexity, not maximum family completeness.

## 20. Source-of-Truth Principle

During initial creation, the CSV files are the human-authored seed source.

After import and participant use begins, PostgreSQL becomes the live source of truth.

Do not routinely re-import edited CSV files over an active family database.

Later changes should occur through application workflows or purpose-built administrative migration tools.

## 21. Seed Definition of Done

Seed infrastructure is complete when:

- family steward can author People and Relationships without database knowledge;
- validation identifies structural mistakes;
- valid data imports reproducibly;
- imported data produces both generational and network graph views;
- private family data can remain outside public source control;
- the application can distinguish preexisting People, joined Members, and Members who have not yet identified themselves.