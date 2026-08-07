# SPEC-04 — Appointment Scheduling v2

**Date:** 2026-08-07 · **Status:** Phase 1 unblocked, Phase 2 blocked on client · **Owner:** Intern B
**Blocked on client:** **Resolved 2026-08-07** — see [CLIENT-ANSWERS.md](../CLIENT-ANSWERS.md).

> **A6 was delegated to us** ("make your decision"). Our decisions, all shipping as **admin-editable settings** rather than constants: **30-minute slots** · **capacity 1 per slot** · **lunch break 13:00–14:00** · **Mon–Sat 09:00–18:00, Sunday closed**.
>
> **A5:** all 27 branches share one pattern — helpful, but the pattern itself was not supplied. The hours above are inferred from the "9am – 6pm" on the input form ([O-2](../CLIENT-ANSWERS.md)). Because they are configuration, a wrong inference costs a minute to correct rather than a release.
>
> **Also decided:** appointments now **require an account** (B4) — the existing guest-booking path must close. See [SPEC-06 R6](SPEC-06-order-lifecycle.md).
>
> **Effect on this spec:** Phase 2 (R5–R7) is **no longer blocked**. Build it as configuration with the defaults above.
**Source:** [FEATURE-STATUS §4](../FEATURE-STATUS.md), [TEAM-PLAN §5](../TEAM-PLAN.md), [CODE-REVIEW H-2](../CODE-REVIEW.md)

---

## Problem Statement

Appointment booking works, but its scheduling rules are **assumptions hardcoded where the client's answers should be**: 30-minute slots, one patient at a time, no lunch break, and a single opening-hours range per branch with no per-weekday breakdown. The client was asked all four questions and answered none of them.

Worse, the one rule the system does enforce — one booking per slot — **is not actually enforced**. It is checked with a `SELECT` and then applied with a separate `INSERT`, with no database constraint behind it, so two concurrent bookings both succeed. There is a second, already-documented path where an admin rescheduling from the panel skips the check entirely.

For a 27-branch optician offering free eye tests as the top-of-funnel offer, a double-booked slot means two patients arrive for one optometrist. The failure is not visible in the software; it is visible in the waiting room.

## Goals

1. **A slot cannot be double-booked**, through any path — customer booking, admin reschedule, or two concurrent requests.
2. **Scheduling rules are configuration, not constants** — duration, capacity, and breaks are set per branch without a deploy.
3. **Branch hours reflect reality per weekday**, including closed days, so no customer books a slot on a day the branch is shut.
4. **Booking success rate is high** — a customer who tries to book gets a real appointment.
5. **The system is ready for the CR-01 doctor module** without a second rewrite of the slot engine.

## Non-Goals

| Not doing | Why |
| --- | --- |
| Doctor / optometrist model, availability, consultations | CR-01, blocked on Section 5, unquoted. But see R7 — the data model must not preclude it. |
| Payment at booking | Client confirmed eye tests are free and no deposit is taken. Meaningful simplification; keep it. |
| Calendar integrations (Google, Outlook) | Not in the SOW, no evidence of demand. |
| Waitlists / automatic rebooking | Premature before real booking volume exists. |
| Branch locator map | Blocked on coordinates — **zero of 27** branches have them ([D1, D2](../CLIENT-QUESTIONS.md)). List-based locator ships; the map is a progressive enhancement. |
| Rescheduling policy windows ("no changes within 24h") | No client input. Do not invent a policy. |

## User Stories

### Customer

- As a customer, I want to see only genuinely available times at my chosen branch, so that my booking is not rejected or, worse, silently double-booked.
- As a customer, I want the branch's real opening days shown, so that I do not try to book a Sunday at a branch that closes Sundays.
- As a customer, I want a confirmation and a reminder, so that I actually attend. *(Already built and working — must not regress.)*
- As a customer, I want to reschedule or cancel myself, so that I do not have to phone the branch.

### Optex branch staff

- As a branch manager, I want my branch's opening hours per weekday, including our closed day, so that bookings match when we are actually open.
- As a branch manager, I want a lunch break blocked out, so that patients are not booked while the branch is unattended.
- As a branch manager, I want to set how many patients we can see at once, so that a two-optometrist branch is not limited to one.
- As a branch manager, I want to set appointment length to match how long a test actually takes.
- As an admin rescheduling a booking, I want to be prevented from creating a clash, so that I do not create a problem I will only discover when both patients arrive.

### Edge cases

- Two customers submit the same slot within milliseconds.
- An admin reschedules into a slot a customer books simultaneously.
- Branch hours change while future bookings exist outside the new hours.
- Capacity is reduced below the number of bookings already taken for a slot.
- A booking spans a newly-added lunch break.

## Requirements

### Phase 1 — P0, unblocked, start now

**R1. Database-enforced slot capacity.**
The current check is a read-then-write race with nothing behind it ([CODE-REVIEW H-2](../CODE-REVIEW.md)). Make the database the arbiter.

- [ ] A constraint prevents more bookings for a `(branch, slot)` than capacity permits
- [ ] Given two concurrent bookings for the last free slot, then exactly one succeeds and the other receives a clear "already booked" response
- [ ] The constraint ignores cancelled appointments
- [ ] A concurrency test exists and runs in CI

> **Design note:** the obvious implementation is a partial unique index on `(branch_id, scheduled_at)`, which hardcodes capacity = 1 — the very assumption [A6](../CLIENT-QUESTIONS.md) asks about. Prefer a capacity-aware constraint from the start so the client's answer does not force a second migration. If capacity-aware proves disproportionate, ship the unique index and accept the follow-up, but decide deliberately rather than by default.

**R2. Close the admin reschedule bypass.**
`Appointments.tsx` writes to Supabase directly from the browser, skipping every validation the API performs.

- [ ] Admin confirm, cancel and reschedule all route through the API
- [ ] Given an admin rescheduling into a full slot, then the change is rejected with a clear message
- [ ] No direct database writes remain in the admin appointments component

> R1 and R2 are complementary, not alternatives. R2 without R1 leaves the concurrency race. R1 without R2 leaves the admin path skipping branch-hours and slot-grid validation. The [TEAM-PLAN](../TEAM-PLAN.md) Phase I exit criterion — *"an admin can no longer double-book a slot"* — requires **both**.

**R3. Per-weekday branch hours in the admin panel.**

- [ ] Admin sets open and close per weekday, and marks days closed
- [ ] Given a day marked closed, then no slots are offered and direct booking attempts are rejected
- [ ] Existing branch data migrates without loss
- [ ] Fix the misleading schema comment at `0001_init_schema.sql:31`, which documents a shape the code does not use

**R4. Seed the 27 real branches.**
Name, address, phone and manager are supplied and ready ([ROADMAP A.1](../ROADMAP.md)). Hours and coordinates are not — seed what exists.

- [ ] All 27 branches present with supplied fields
- [ ] Branches without hours are clearly not bookable rather than silently defaulting to a guess

### Phase 2 — P0, blocked on client (A5, A6)

**R5. Configurable slot duration per branch.** Currently a global `SLOT_MINUTES = 30` constant.

- [ ] Duration is set per branch from an agreed set of options
- [ ] Slot generation follows the configured duration
- [ ] Given duration changes with future bookings existing, then those bookings are preserved and surfaced as off-grid rather than deleted

**R6. Configurable capacity per slot.** Currently hardwired to one — the check is set-membership, not a count.

- [ ] Capacity is set per branch
- [ ] A slot shows as available until capacity is reached
- [ ] R1's constraint enforces the configured capacity, not a fixed 1
- [ ] Given capacity is reduced below existing bookings, then existing bookings are honoured and the slot is simply full

**R7. Breaks and buffers.**
This is **missing code, not missing configuration** — slot generation is a straight open-to-close range with no concept of an exclusion.

- [ ] Admin defines one or more unavailable windows per branch per weekday
- [ ] Slots overlapping a break are not offered
- [ ] Given a break added where bookings exist, then those bookings are preserved and flagged for staff attention
- [ ] The exclusion model is general enough to later represent per-doctor availability (CR-01) without redesign — this is the one place where thinking ahead costs almost nothing and saves a rewrite

### P1 — Should have

- **R8.** Customer-facing view of their upcoming appointments with reschedule and cancel. *(API exists; surface it.)*
- **R9.** Branch-level day view in the admin panel, so staff can see tomorrow at a glance.
- **R10.** Blocked dates for public holidays and closures — Kenya has fixed public holidays that will otherwise take bookings every year.

### P2 — Future considerations

- Doctor assignment per appointment (CR-01.5) — R7's exclusion model is the hook.
- Per-appointment-type durations, once consultation types are defined.
- Automatic no-show marking and follow-up.

## Success Metrics

**Leading (first 30 days):**

| Metric | Success | Method |
| --- | --- | --- |
| Double-booked slots | **0** | Database audit query, weekly |
| Bookings rejected by a validation error | < 3% of attempts | API logs |
| Branches with complete per-weekday hours | 27 of 27 | Admin data check |
| Slot-availability response time | < 500ms | API metrics |

**Lagging (first quarter):**

| Metric | Success | Stretch | Method |
| --- | --- | --- | --- |
| Appointment attendance rate | > 70% | > 85% | Admin status transitions |
| Bookings cancelled by Optex (staff-side clash) | 0 | 0 | Admin cancellation reason |
| Self-service reschedules vs. phone calls | > 50% self-service | > 75% | API vs. admin origin |
| Eye tests booked online per month | Baseline established | Growth | Admin report |

## Open Questions

| # | Question | Owner | Blocking? |
| --- | --- | --- | --- |
| Q1 | Per-weekday opening hours and weekly off day for all 27 branches. *One answer covers all if the pattern is shared* | Client ([A5](../CLIENT-QUESTIONS.md)) | **Yes** for R3 to be useful; R3 can be built against it |
| Q2 | Slot duration — 15 / 30 / 60 min | Client ([A6](../CLIENT-QUESTIONS.md)) | **Yes** for R5 |
| Q3 | How many patients simultaneously per branch | Client ([A6](../CLIENT-QUESTIONS.md)) | **Yes** for R6, and it shapes R1's constraint design |
| Q4 | Daily break windows (e.g. lunch 1–2pm) | Client ([A6](../CLIENT-QUESTIONS.md)) | **Yes** for R7 |
| Q5 | Do all 27 branches share one pattern, or does each differ? Materially changes both the admin UX and the data-entry effort | Client | No — build per-branch, which handles both |
| Q6 | What happens to existing bookings when hours or capacity change? | Product (Kalyan) | No — specced above as preserve-and-flag; confirm |
| Q7 | Should customers book a specific optometrist? | Client (CR-01, [Block G](../CLIENT-QUESTIONS.md)) | No — R7's design keeps the door open |

## Timeline Considerations

**Phase 1 (R1–R4) is unblocked** and contains the only defect in this spec that is live today. It should start immediately regardless of client responsiveness.

**Phase 2 (R5–R7) is fully blocked on Section 4.** These are four short factual questions the client can answer in one sitting; they have been outstanding since the input form went out. Escalate rather than build against guesses — [ROADMAP](../ROADMAP.md) is right that building against assumed requirements wastes the effort twice.

**Interaction with R1:** the capacity question (Q3) shapes R1's constraint. Since R1 is urgent and Q3 is outstanding, either (a) build capacity-aware now and default to 1, or (b) ship the unique index and plan the migration. **Recommend (a)** — the cost difference is small and it removes a follow-up migration on a table holding live bookings.

**Estimate:** Phase 1 — 1 sprint. Phase 2 — 2 sprints from the date Section 4 returns.
