# OPTEX — Payments Go-Live Follow-Up

**Date:** 2026-08-24 · **Ref:** OPTEX-SOW-2025-001-KE v3.0
**For:** Paul (SPOC)
**Status:** Draft — not yet sent (no email address on file for Paul; see [CLIENT-QUESTIONS.md D6](CLIENT-QUESTIONS.md))

Narrow, payment-only follow-up, separate from the full backlog in [CLIENT-QUESTIONS.md](CLIENT-QUESTIONS.md) / [CLIENT-ANSWERS.md](CLIENT-ANSWERS.md). Payments integration is otherwise finished; these seven items are the only thing left before it can go live.

---

## Draft email

**Subject: Payments are ready to go live — 7 items needed from your side**

> Hi Paul,
>
> Quick, narrow follow-up — separate from the full open-questions list — because payments integration is otherwise finished and this is now the only thing standing between it and going live.
>
> **The credentials themselves haven't actually reached us yet.** We understood from the last round that your Daraja and Pesapal accounts were set up and ready, but nothing has come through — our M-Pesa and Pesapal config is still empty on our end. Could you send:
>
> 1. **Daraja (M-Pesa) API credentials** — Consumer Key, Consumer Secret, Business Shortcode, Passkey
> 2. **Pesapal credentials** — Consumer Key, Consumer Secret, and your IPN ID (or confirm you still need to register one)
> 3. **Your KRA PIN** — required by both providers for merchant verification; you confirmed you have one but it was never included
> 4. **Settlement bank name and account name** — same, confirmed but not sent
> 5. **Domain/DNS access, or confirmation of who's setting it up** — the payment callback URLs need to point at your live domain before we can register them with Safaricom/Pesapal, so this has to land before go-live regardless of the wider hosting question
> 6. **A named person to own daily payment reconciliation** — the admin panel has a reconcile screen for matching payments to orders; since a person's actions there move money, we need a name and role before we hand it over, not after
> 7. **The free-delivery threshold, in KES** — you answered "$39" earlier, but we're KES-only (confirmed), so we need the actual number. It feeds directly into the order totals payments will charge, so it's effectively blocking this too.
>
> Everything else on payments — the M-Pesa/Pesapal integration, callback verification, the reconcile screen, refund/reversal handling — is built and tested. Once these seven land, we can move straight to go-live testing on payments specifically.
>
> Happy to jump on a quick call if that's faster than typing it all out — particularly for #1 and #2, since those shouldn't go over email or chat if avoidable.
>
> Thanks,
> [Your name]

---

## Open before sending

- **No email address on file for Paul** ([D6](CLIENT-QUESTIONS.md)) — need a channel to send this through.
- Items #1 and #2 (Daraja/Pesapal secrets) are worth collecting via a secure channel (password manager, call) rather than plain email/chat — decide the method before sending.
- This list assumes nothing on #1–#7 has been resolved through a channel outside this repo since the last written update (2026-08-07); worth a quick check before sending.
