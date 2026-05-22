# Raket — Cross-Border Payments for Filipino Freelancers

Over 1.5 million Filipinos freelance for international clients — developers, designers, writers earning in USD — yet every payment option available to them is slow, expensive, or both. PayPal charges 4–7% all-in and holds funds for days. Bank wires add ₱500+ in fees and route through SWIFT infrastructure built in the 1970s. No product is built specifically for this user.

Raket solves this with Morph. When a client pays by card via Stripe, Raket settles the equivalent USDC across the Morph Holesky testnet in under two seconds — replacing the correspondent-bank hops entirely. From there, Coins.ph converts USDC to PHP and delivers it to the freelancer's GCash via InstaPay, with a public Morph Explorer link as the on-chain receipt. Every transaction is verifiable, not just fast.

We used Morph's EVM-compatible L2 for on-chain USDC settlement, viem for contract interaction, and Supabase Realtime to push the confirmation toast the moment the transaction is confirmed. Stripe handles card collection; Claude generates invoices from a single sentence.

For the Philippines — and Southeast Asia broadly — this is what financial inclusion looks like at the infrastructure layer: not just lower fees, but faster, transparent rails built for people the legacy system was never designed to serve.
