# Family Network Discovery App
## Milestone 1 — Family Explorer + Onboarding

**Status:** Implementation specification  
**Parent document:** Discovery App PRD v0.1  
**Purpose:** Build the first usable vertical slice of the Family Network Discovery App.

## 1. Milestone Objective

Milestone 1 tests whether a newly invited family member can enter an unfamiliar but recognizable family network, understand the graph, find or establish their own identity, and begin exploring family relationships without outside instruction.

The central user question is:

**“Can I understand where I fit in this family?”**

Milestone 1 is not intended to test collaborative verification, administration, monetization, AI assistance, or full invitation/network-growth behavior.

## 2. Primary User Journey

A first-time participant shall be able to:

1. Open the application.
2. See a welcome/setup panel and the family graph.
3. Enter required basic profile information.
4. Search for people by name.
5. Navigate the graph visually through pan, zoom, node selection, and layout changes.
6. Inspect immediate connectivity around selected people.
7. Find an existing Person node representing themselves and claim it.
8. Alternatively, indicate that they do not appear in the graph.
9. Add themselves as a new Person.
10. Connect that new Person to at least one existing family member through a primitive relationship.
11. Complete onboarding.
12. Enter the normal Family Explorer state.

The participant shall not be able to perform ordinary family-graph editing until identity setup is complete.

## 3. Family Explorer Shell

The Family Explorer is the primary application shell used both during onboarding and after onboarding.

Desktop layout should normally contain:

- setup/context panel;
- search;
- interactive family graph;
- graph controls;
- selected-person context.

Mobile shall use the same functionality in a responsive arrangement rather than a separate application.

The graph should occupy the majority of the available visual area.

## 4. First-Time Setup State

A first-time member shall see a welcome message similar to:

**Welcome to your Family Network**

**Before you begin, tell us who you are in the family.**

Required information:

- display name;
- date of birth;
- identity association with an existing Person OR creation of a new Person anchored to an existing family member.

The final onboarding action shall remain disabled until these conditions are satisfied.

Suggested completion indicators:

- Name entered
- Date of birth entered
- Identity established

## 5. Birth-Date Privacy

A full date of birth may be collected for identification and future system functions.

Storage of the date does not imply visibility to other family members.

At minimum, the member shall be able to distinguish between:

- sharing month/day;
- sharing birth year.

Example:

Stored DOB:

`1965-05-03`

Visibility preferences:

`share_birth_month_day = true`

`share_birth_year = false`

A member could therefore appear as:

**Birthday: May 3**

without exposing the year.

The system architecture shall allow future separation of:

- information storage;
- member visibility;
- use by intelligent/AI features.

Permission to store personal information shall not be treated as permission to publicly display it or use it to generate inferred personal context.

## 6. Finding Yourself

The member shall be able to find themselves using either:

### Search

Search by partial name.

Results should display enough family context to distinguish people with identical or similar names.

Example:

**Ravi Kini**  
Son of Suresh and Meena

**Ravi Kini**  
Son of Arun and Lakshmi

Selecting a search result shall highlight and center the corresponding Person node in the graph.

### Visual Graph Exploration

The participant may navigate the graph directly rather than using search.

The graph shall support:

- pan;
- zoom;
- node selection;
- node repositioning;
- centering on a selected person;
- inspection of immediate connections;
- switching between supported layouts.

Selecting a graph node shall update the person context displayed elsewhere in the UI.

Search and graph interaction must therefore be bidirectional.

## 7. Identity Claim

After selecting an existing Person, the participant may choose:

**This is me**

The UI shall show identifying context before confirmation.

On confirmation:

- Member is associated with that Person;
- identity setup is considered satisfied;
- that Person can be visually identified as “You.”

A Person may not normally be claimed by more than one Member.

If a Person is already claimed, the participant shall be informed and offered:

- return to search;
- create themselves as a different Person.

Administrative resolution of incorrect claims is outside Milestone 1.

## 8. Person Not Found

The onboarding UI shall include:

**I don't see myself**

or equivalent.

The system shall create a new Person using the user's entered profile information.

The newly created Person shall initially remain unanchored.

The application shall then require:

**Connect yourself to someone already in the family.**

The participant may search or navigate the graph and select an existing Person.

They must establish at least one primitive relationship:

- Parent
- Child
- Sibling
- Spouse/Partner

After confirmation, the new Person and edge shall appear immediately in the graph.

Verification is not required in Milestone 1.

The relationship shall nevertheless retain creation provenance so that future verification workflows can operate on it.

## 9. Graph Model and Visualization

The visual metaphor is a **Family Relationship Graph**, not a rigid pedigree tree.

People are nodes.

Relationships are typed edges.

The underlying graph is independent of visual layout.

Graph meaning shall not change when nodes are repositioned.

### Required Layouts

Milestone 1 shall support:

**Generational Layout**

Best-effort arrangement based primarily on parent-child relationships.

The interface should attempt to present recognizable generations while allowing relationships that cross branches or do not fit a strict tree.

**Network Layout**

A less hierarchical connectivity-oriented layout intended to make the network structure visible.

Switching layouts changes only geometry, never Person or Relationship data.

## 10. Graph Layout Invariance

The following must remain unchanged when layouts change or nodes are dragged:

- Person identity;
- relationships;
- relationship type;
- relationship provenance;
- profile data;
- Member associations.

Screen coordinates are presentation state, not family-domain data.

## 11. Relationship Visualization

Primitive relationship types shall be visually distinguishable.

Required relationship semantics:

- Parent/Child
- Spouse/Partner
- Sibling

Visual distinction may use:

- color;
- line style;
- symbols;
- labels.

Color must not be the only distinguishing signal.

A selected Person's immediate relationships should be visually emphasized while unrelated graph elements may be subdued.

## 12. Node Interaction

A selected node should provide at least:

- display name;
- immediate relationship context;
- ability to center the graph on that Person.

Desktop may additionally provide a hover summary if inexpensive to implement.

Mobile shall use tap/select rather than hover.

Profile summaries must honor privacy settings.

## 13. Returning-User State

After onboarding, the Family Explorer remains the main shell.

The first-time setup panel is replaced with a returning-user context such as:

**Welcome back, Maya**

The Member's Person node should be easily identifiable.

Milestone 1 need not expose full family-editing capabilities beyond adding oneself and establishing the initial relationship.

## 14. Functionality Locked Before Identity Completion

Allowed before identity completion:

- search;
- graph viewing;
- pan;
- zoom;
- layout switching;
- node selection;
- inspection of permitted profile context.

Not allowed before identity completion:

- ordinary person creation except “Add myself”;
- ordinary relationship editing;
- invitations;
- verification;
- disputes;
- profile changes to other people.

## 15. Behavioral Instrumentation

Milestone 1 shall record interaction events even though no analytics dashboard is required.

Minimum event types:

- session_started
- graph_viewed
- graph_zoomed
- graph_panned
- graph_layout_changed
- person_searched
- search_result_selected
- person_selected
- identity_claim_started
- identity_claimed
- identity_not_found
- person_created
- relationship_created
- onboarding_completed

High-frequency pan/zoom actions may be aggregated or throttled to avoid excessive event generation.

Events should contain where applicable:

- timestamp;
- Member ID;
- Person ID;
- Relationship ID;
- event type;
- lightweight metadata.

## 16. Explicitly Deferred

Not required in Milestone 1:

- peer verification;
- verifier nomination;
- relationship disputes;
- administrative dashboard;
- activity feed;
- complete invitation workflow;
- AI assistance;
- social-media discovery;
- photos;
- stories;
- genealogy records;
- advanced relationship terminology;
- payments;
- native mobile applications;
- sophisticated profile editing.

## 17. Acceptance Scenario A — Existing Person

Without assistance, a test participant must be able to:

Open application → enter name/DOB → explore/search graph → locate themselves → inspect surrounding family → select “This is me” → complete onboarding → enter normal Family Explorer.

## 18. Acceptance Scenario B — Missing Person

Without assistance, a participant must be able to:

Open application → enter name/DOB → fail to find themselves → select “I don't see myself” → create themselves → locate an existing relative → specify Parent/Child/Sibling/Spouse relationship → see themselves immediately appear in graph → complete onboarding.

## 19. Discovery Test

A successful implementation should allow a test participant to use the application from a URL without verbal instructions.

Observe:

- whether search or visual traversal is used first;
- whether generational or network layout is easier to understand;
- whether participants recognize immediate relatives;
- whether similar names cause confusion;
- whether users understand “This is me”;
- whether missing users can anchor themselves correctly;
- whether graph manipulation feels intuitive;
- where participants hesitate or request assistance.

## 20. Milestone Definition of Done

Milestone 1 is complete when both canonical onboarding scenarios operate against persistent data, the graph supports both required layouts, relevant interactions are instrumented, and the application can be hosted for a small family usability pilot.