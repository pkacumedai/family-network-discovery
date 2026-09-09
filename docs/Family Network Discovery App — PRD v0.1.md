# Family Network Discovery App
## Product Requirements Document — v0.1

**Status:** Discovery Prototype  
**Date:** September 8, 2026  
**Purpose:** Product and behavioral validation  
**Target:** Responsive web application

---

# 1. Purpose

The Family Network Discovery App is a functional prototype for testing whether members of an extended family will collaboratively build, validate, explore, and expand a shared representation of their family relationships.

The prototype is not intended to validate the complete long-term product vision.

Its primary purpose is to answer:

> **Can a small seeded family graph become self-expanding and self-validating through participation by invited family members?**

A secondary objective is to determine whether the resulting graph provides enough immediate utility and curiosity to encourage continued exploration and contribution.

The application therefore prioritizes:

- extremely low-friction participation;
- instantaneous graph updates;
- simple collaborative relationship creation;
- peer verification;
- relationship exploration;
- invitations and network growth; and
- detailed behavioral instrumentation.

---

# 2. Discovery Hypotheses

## H1 — Relationship Utility

Family members find value in seeing an interactive representation of their extended family and understanding how people are related.

## H2 — Contribution

After exploring the graph, a meaningful percentage of participating members will add or correct people and relationships.

## H3 — Collaborative Validation

Members will respond to requests from other family members to verify proposed relationships.

## H4 — Network Expansion

Existing participants will invite additional relatives rather than relying exclusively on the original family founder.

## H5 — Decentralized Maintenance

The family graph will continue to expand and improve without continuous intervention by the founder.

## H6 — Exploration

Some users who contribute little or nothing will nevertheless repeatedly use the application to explore people and relationships.

---

# 3. Scope

## Included in v0.1

- Responsive web interface
- Seeded starter family graph
- Invitation-based membership
- Identity claim
- Interactive family graph
- Person search
- Basic person creation
- Relationship creation
- Immediate display of proposed relationships
- Peer verification
- Relationship status
- Relationship-path exploration
- Simple activity feed
- Invitation of additional relatives
- Administrative controls
- Engagement/event tracking
- Simple administrator analytics

## Explicitly Out of Scope

The following are intentionally deferred:

- Native iOS application
- Native Android application
- AI/agentic relationship discovery
- Automated social-media discovery
- Historical-record search
- DNA integration
- Sophisticated genealogy research
- Photos and media management
- Rich family stories/anecdotes
- Natural-language graph queries
- Advanced privacy management
- Reputation algorithms
- Weighted verification
- Commercial subscriptions
- Payment processing
- Sophisticated notifications
- Production-scale identity infrastructure

These capabilities may be simulated during discovery interviews but should not delay v0.1.

---

# 4. Participant Model

The prototype distinguishes between a **Person** represented in the family graph and a **Member** who has access to the application.

A deceased ancestor, child, or relative who has never joined may be a Person without being a Member.

A participating family member is both a Person and a Member.

This distinction is fundamental.

## 4.1 Member States

### Invited

The individual has been invited but has not joined the family network.

### Joined

The individual has accepted an invitation and associated their membership with a Person in the family graph.

### Contributor

A joined member who has completed at least one qualifying contribution.

Qualifying contributions include:

- adding a person;
- proposing a relationship;
- confirming a relationship; or
- disputing a relationship.

Merely viewing the graph does not establish Contributor status.

### Administrator

A member with administrative privileges.

The Founder is initially an Administrator.

Additional administrators may be designated manually.

---

# 5. Initial Family Creation

The first family network is created by the Founder/Administrator.

Before inviting participants, the Founder creates a starter graph containing enough people and relationships to make the application immediately recognizable to invitees.

The initial graph may be created manually or imported during application setup.

The seed graph should ideally contain multiple generations and several family branches so that invitees encounter recognizable relatives immediately.

Seeded relationships may initially be treated as verified administrator-created relationships.

---

# 6. Invitation Flow

## 6.1 Initial Invitations

The Administrator maintains an initial list of invited family members.

At minimum, an invitation record contains:

- Name
- Email address and/or phone number
- Invitation status
- Unique invitation identifier/token

The initial invitation list may be loaded from a simple file maintained by the Administrator.

The file is a seeding mechanism rather than the live application datastore.

## 6.2 Member-Generated Invitations

Joined members may invite additional relatives.

The application should generate a simple invitation mechanism suitable for:

- email;
- text message; or
- copying into WhatsApp or another messaging application.

The invitation should emphasize family context rather than generic application registration.

Example concept:

> "We've started mapping our extended family so everyone can understand how we're connected. I've added you to our family network."

## 6.3 Invitation Tracking

The system must record:

- inviter;
- invitee;
- date/time invited;
- invitation opened where measurable;
- invitation accepted;
- resulting member identity.

This enables measurement of network propagation.

---

# 7. Joining and Identity Claim

After following an invitation, the invitee sees a simple welcome screen explaining the purpose of the family network.

The application then asks:

> **Who are you in this family?**

The application presents likely existing people from the graph.

The user may:

1. select an existing Person representing themselves; or
2. indicate that they are not yet represented.

If the person already exists, the Member becomes associated with that Person.

If the person does not exist, the application allows creation of a minimal Person record and asks the invitee to establish at least one relationship to an existing person.

The system must prevent accidental duplicate identity claims.

Administrator intervention may be used to resolve ambiguous cases in v0.1.

---

# 8. Person Record

A Person record in v0.1 should remain deliberately minimal.

Required or supported fields:

- Person ID
- Display name
- Optional birth year/date
- Optional death year/date
- Living/deceased indicator
- Optional nickname or alternate name
- Associated Member ID, if applicable

Rich profiles are explicitly deferred.

The goal is relationship identification rather than biographical completeness.

---

# 9. Family Graph

The primary interface is an interactive visual family graph.

Users must be able to:

- see people and relationships;
- pan;
- zoom;
- select a person;
- expand surrounding relationships;
- search for a person;
- identify themselves visually;
- distinguish proposed from verified relationships; and
- navigate to a person's immediate family.

The interface should work effectively on both desktop and mobile web browsers.

The graph should prioritize comprehensibility over displaying the entire family simultaneously.

---

# 10. Relationship Model

## 10.1 Primitive Relationships

v0.1 should support a small set of direct relationships:

- Parent of
- Child of
- Spouse/Partner of
- Sibling of

The application should derive inverse relationships automatically.

For example:

If:

> Anita **parent of** Maya

then:

> Maya **child of** Anita

must not require a second relationship record from the user.

Similarly, sibling and spouse relationships are reciprocal.

## 10.2 Derived Relationships

Relationships such as:

- grandparent;
- aunt/uncle;
- niece/nephew;
- cousin;
- second cousin;

should preferably be calculated from the graph rather than manually entered as primary relationships.

The application should not require users to understand formal genealogy terminology to contribute.

---

# 11. Adding a Relationship

A participant selects a Person and chooses:

> **Add relationship**

The user then:

1. selects the relationship type;
2. selects another existing Person or creates a new Person;
3. reviews the proposed relationship; and
4. submits it.

Example:

> **Deepa**
>
> Add relationship:
>
> Deepa is **parent of** → Maya

The relationship appears in the graph immediately.

It does not wait for verification before becoming visible.

It is clearly identified as:

> **Proposed**

This immediate feedback is a critical v0.1 requirement.

---

# 12. Verification Workflow

## 12.1 Eligibility

Only Members who:

1. have joined the network; and
2. have achieved Contributor status

are eligible to verify proposed relationships.

The proposer cannot verify their own proposal.

Invited-but-not-joined individuals cannot be selected.

Joined members who have never contributed cannot initially act as verifiers.

## 12.2 Verifier Selection

When proposing a relationship, the contributor may nominate eligible Contributors who are likely to know the relationship.

The interface displays only eligible verifiers.

Basic contextual information may be displayed, such as:

- name;
- contribution count; and
- relationship to the relevant people, where readily available.

No formal reputation score is required.

## 12.3 Verification State

Relationships have four possible states:

### Proposed

Submitted but insufficiently verified.

### Verified

Received three confirmations from eligible Contributors.

### Disputed

At least one eligible Contributor disputes the proposal.

### Administrator Resolved

An Administrator manually resolves a disputed or exceptional relationship.

## 12.4 Confirmation

Each eligible verifier may confirm a proposal only once.

At three confirmations, the relationship automatically becomes Verified.

The graph updates immediately.

## 12.5 Dispute

An eligible verifier may dispute a relationship.

A dispute prevents automatic verification and changes the status to:

> **Disputed**

The verifier may optionally provide a short explanation.

Administrator resolution is sufficient for v0.1.

---

# 13. Relationship Exploration

A core v0.1 feature is:

> **How am I related to this person?**

A Member can select another Person and request the relationship path.

The application identifies a graph path between the Member and selected Person.

The result should be understandable without genealogy expertise.

Example:

> **Maya is your first cousin.**
>
> You  
> → child of Anita  
> → sister of Deepa  
> → parent of Maya

Where possible, the application should provide both:

- a human-readable relationship label; and
- the underlying path.

If a conventional relationship label cannot confidently be generated, displaying the relationship path alone is acceptable.

---

# 14. Search

Members can search the family network by name.

Search should support partial matching to address families containing people with identical or similar names.

Results should provide enough relationship context to distinguish individuals.

For example:

> **Ravi Kini**  
> Son of Suresh and Meena
>
> **Ravi Kini**  
> Son of Arjun and Lakshmi

Resolving same-name ambiguity is an explicit discovery use case.

---

# 15. Activity Feed

The application provides a lightweight family activity feed.

Example activities:

- Maya joined the family network.
- Ravi added Suresh.
- Anita proposed that Maya is Deepa's daughter.
- Suresh confirmed a relationship.
- Maya disputed a relationship.
- Ravi invited Priya.
- A relationship received three confirmations and became verified.

The activity feed should reinforce that the graph is collectively maintained.

It is not intended to become a social-media feed.

---

# 16. Administrative Capabilities

The Administrator requires a simple interface to:

- view Members;
- view invitation status;
- add invited individuals;
- resend/copy invitation links;
- correct identity associations;
- view proposed relationships;
- resolve disputes;
- remove obvious test/error records;
- inspect activity;
- inspect engagement metrics.

Administrative functionality should prioritize experiment operation rather than polished user experience.

---

# 17. Engagement Instrumentation

Behavioral measurement is a primary requirement of the Discovery App.

Every meaningful action should generate an event.

## 17.1 Minimum Events

- invitation_created
- invitation_opened
- invitation_accepted
- member_joined
- identity_claimed
- graph_viewed
- person_viewed
- person_searched
- person_added
- relationship_proposed
- verifier_selected
- relationship_confirmed
- relationship_disputed
- relationship_verified
- relationship_path_queried
- invitation_sent

Each event should contain at minimum:

- event ID;
- timestamp;
- Member ID;
- event type;
- relevant Person ID where applicable;
- relevant Relationship ID where applicable;
- optional event metadata.

---

# 18. Engagement Dimensions

Participant behavior should be categorized into four broad dimensions.

### Explore

Examples:

- graph views;
- person views;
- searches;
- relationship-path queries.

### Contribute

Examples:

- people added;
- relationships proposed.

### Verify

Examples:

- confirmations;
- disputes.

### Grow

Examples:

- invitations sent;
- invitations accepted.

This allows discovery of behavioral personas without defining them prematurely.

---

# 19. Administrator Analytics

The Discovery App should include a basic experiment dashboard.

## Participant Metrics

For each Member:

- invitation date;
- join date;
- last active date;
- number of sessions where measurable;
- graph/person views;
- searches;
- relationship queries;
- people added;
- relationships proposed;
- confirmations;
- disputes;
- invitations sent;
- invitations accepted.

## Family-Level Funnel

The dashboard should show:

> **Invited → Joined → Contributed → Invited Others**

For example:

> 52 invited  
> ↓  
> 37 joined — 71%  
> ↓  
> 24 contributed — 65% of joiners  
> ↓  
> 11 invited another relative — 46% of contributors

## Graph Metrics

Track:

- total people;
- total relationships;
- verified relationships;
- proposed relationships;
- disputed relationships;
- people added by Founder;
- people added by non-Founder Members;
- percentage of graph growth attributable to non-Founder Members.

The last measure is particularly important for testing decentralized growth.

---

# 20. Experimental Success Indicators

v0.1 does not require predetermined statistical success thresholds.

The experiment should instead seek strong directional behavioral evidence.

Particularly positive signals include:

- high invite acceptance;
- members identifying themselves without assistance;
- members correcting incomplete information;
- members adding relatives;
- verification requests receiving responses;
- members inviting additional relatives;
- repeated relationship exploration;
- graph growth occurring without Founder intervention;
- continued activity after the Founder deliberately reduces participation.

A particularly important experiment will be a period during which the Founder stops contributing.

The question is:

> **Does the family network continue to grow without its creator?**

---

# 21. Qualitative Research

Behavioral telemetry should be combined with participant interviews.

Follow-up interviews should explore:

- What caused you to open the invitation?
- What did you do first?
- Did you recognize the people shown?
- What was confusing?
- What information did you feel motivated to correct?
- Why did you add—or not add—another relative?
- Why did you invite—or not invite—someone?
- Was verifying another person's contribution comfortable?
- Did you trust the information shown?
- What made you return?
- What would make you use this regularly?
- What information would you refuse to put here?
- What would make this valuable enough to preserve permanently?

The combination of **observed behavior + interview explanation** is more important than either alone.

---

# 22. UX Principles

## Immediate Feedback

Every contribution must produce visible feedback immediately.

A relationship should appear as Proposed as soon as it is submitted.

## Minimal Data Entry

Do not ask participants to complete unnecessary profile information.

## Recognition Before Contribution

Users should see recognizable family information before being asked to do substantial work.

## Curiosity as Reward

Exploration should provide immediate value, particularly through:

> **How am I related?**

## Progressive Complexity

Users should not need to understand genealogy terminology or graph concepts.

## Mobile-First Participation

Although v0.1 is a web application, invitation, identity claim, relationship creation, verification, and exploration must work well from a phone browser.

---

# 23. Privacy Requirements for Discovery

Even though v0.1 is a prototype, family information should not be publicly accessible.

Minimum requirements:

- invitation-controlled access;
- unique Member identity;
- family data inaccessible without authorization;
- no public indexing;
- no public family URLs exposing graph contents;
- Administrator ability to remove a Member;
- basic activity audit trail.

More sophisticated privacy controls are deferred, but privacy itself is not.

---

# 24. Data Preservation

Although the Discovery App is experimental, participant contributions should not be treated as disposable.

The application must support export of:

- People
- Relationships
- Members
- Verification history
- Invitations
- Activity events

The prototype may eventually be replaced, but the family information should be portable into a subsequent version.

---

# 25. Initial User Journey

The canonical v0.1 journey is:

**1. Receive invitation**

↓

**2. Open family network**

↓

**3. Recognize family members**

↓

**4. Identify "This is me"**

↓

**5. Explore immediate relationships**

↓

**6. Ask "How am I related to...?"**

↓

**7. Discover missing or incorrect information**

↓

**8. Add person or propose relationship**

↓

**9. See change immediately**

↓

**10. Select knowledgeable Contributors to verify**

↓

**11. Invite missing relative**

↓

**12. Return when asked to verify another contribution**

This is the principal behavioral loop that v0.1 is designed to test.

---

# 26. Product Flywheel

The hypothesized discovery flywheel is:

**Family curiosity**

→ **Explore relationships**

→ **Identify missing knowledge**

→ **Contribute**

→ **Request peer verification**

→ **Invite knowledgeable relatives**

→ **More family joins**

→ **Graph becomes richer**

→ **Relationship exploration becomes more useful**

→ **Greater family curiosity**

The Discovery App succeeds if there is evidence that this flywheel can become self-sustaining.

---

# 27. Acceptance Criteria for v0.1

v0.1 is ready for a real-family pilot when an Administrator can:

1. seed a multi-generation family;
2. load an invitation list;
3. invite participants;
4. observe invitation and participation status;
5. inspect graph changes and activity; and
6. review basic engagement analytics.

An invited participant must be able to:

1. follow an invitation from a mobile or desktop browser;
2. join the family;
3. identify themselves;
4. explore the graph;
5. search for people;
6. determine how another person is related to them;
7. add a missing Person;
8. propose a relationship;
9. immediately see that proposed relationship;
10. select eligible Contributors as verifiers;
11. confirm or dispute another Member's proposal; and
12. invite another family member.

The application must automatically:

1. maintain Person and Member as separate concepts;
2. derive inverse primitive relationships;
3. prevent self-verification;
4. prevent duplicate verification;
5. restrict verification to eligible Contributors;
6. verify a relationship after three valid confirmations;
7. flag disputed relationships;
8. record provenance;
9. track behavioral events; and
10. preserve/export the resulting graph.

---

# 28. What v0.1 Is Intended to Teach Us

At the end of the pilot, we should be able to answer:

### Utility
Do people actually explore the graph?

### Contribution
Do they improve it without being asked individually?

### Verification
Will family members collectively validate family information?

### Growth
Will participants invite additional relatives?

### Decentralization
Does graph growth continue without the Founder?

### Engagement
Which behaviors cause people to return?

### Governance
Does three-person verification work naturally, or does it create excessive friction?

### Identity
How often do duplicate names and ambiguous identities create problems?

### Privacy
What information are participants comfortable sharing?

### Future Product
Which capabilities do participants spontaneously request?

These answers—not feature completeness—determine whether the Discovery App has succeeded.

---

# 29. Guiding Constraint

When considering any additional v0.1 feature, ask:

> **Does this feature materially improve our ability to test collaborative family-network formation, validation, exploration, or growth?**

If the answer is no, defer it.

The purpose of v0.1 is not to demonstrate everything the eventual product could become.

It is to determine whether the **core family-network behavior exists at all.**