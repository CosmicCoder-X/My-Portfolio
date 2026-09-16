---
title: "Joker's Stash: anatomy of a billion-dollar carding market"
date: 2026-09-15
summary: 'How the largest dark-web carding marketplace in history ran for six years on blockchain DNS and a tiered escrow system, survived a federal seizure attempt, and shut itself down on its own terms: a look at the machinery behind $1B+ in stolen card data, and what it tells defenders about takedown resilience.'
tags: ['Threat Intelligence', 'Carding', 'Dark Web', 'Cybercrime', 'Payment Card Fraud', 'OSINT']
draft: false
---

This one is research, not a personal engagement: a look at a piece of cybercrime
infrastructure worth understanding from the defensive side: how it was built to
survive takedown attempts, how its economics worked, and why a law-enforcement
seizure that should have ended it in December 2020 didn't.

## What it was

Joker's Stash opened in October 2014 as a Russian- and English-language carding
market, a shop for "dumps": Track 1/Track 2 magnetic-stripe data lifted from
compromised point-of-sale systems and card skimmers, sold alongside CVV2 records
for card-not-present fraud. Buyers used the data to clone physical cards or run
fraudulent online transactions. Over six years it became, by most threat-intel
estimates, the largest marketplace of its kind ever to operate.

It ran a tiered partner system: bulk buyers got wholesale discounts, and the
highest-volume customers carried five- and six-figure account balances on the
platform. [Gemini Advisory estimated the site generated more than $1 billion in
revenue](https://geminiadvisory.io/jokers-stash-shuts-down/) across its run. A
2024 U.S. indictment put the scale in card terms rather than dollars: roughly 40
million payment cards listed per year, hundreds of millions over the site's
lifetime, and estimated profits between $280 million and over $1 billion; in
the Justice Department's words, "one of the largest known carding markets in
history."

Stolen data traced back to Joker's Stash surfaced from breaches at Saks Fifth
Avenue, Lord & Taylor, Bebe Stores, Hilton, Jason's Deli, Whole Foods, Chipotle,
Wawa, Sonic Drive-In, Hy-Vee, Buca di Beppo and Dickey's BBQ, among others; the
site functioned as the retail layer for a supply chain of POS breaches and
skimming operations run by other actors entirely.

## Built not to be taken down

The technical decision that mattered most was infrastructure, not the storefront
itself. Starting in 2017, Joker's Stash ran on
[Emercoin's blockchain-based DNS](https://www.recordedfuture.com/research/jokers-stash-infrastructure),
reachable through non-ICANN top-level domains like `.bazar`, `.lib`, `.emc` and
`.coin`, alongside conventional Tor `.onion` mirrors. A blockchain-registered
domain has no central registrar to serve a takedown notice to, and registration
records carry an encrypted hash rather than a name or address: the exact
property that makes seizing a `.com` straightforward and seizing a `.bazar`
domain close to impossible through the usual legal channels.

[Recorded Future's Insikt Group tracked 49 servers and 543 domains](https://www.recordedfuture.com/research/jokers-stash-infrastructure)
linked to the operation with high confidence. That's not a website; it's a
distributed system built with the assumption that pieces of it would be found
and burned, and sized so that losing any of them wouldn't matter.

## The seizure that didn't work

On 16 December 2020, a number of Joker's Stash's domains started displaying
seizure banners from the U.S. Department of Justice and Interpol. By most
takedown playbooks, that's the story's ending. It wasn't: the operators had
the site back up on new infrastructure within days, and trading continued
essentially uninterrupted. The blockchain-DNS design meant the seizure could
only ever reach the fraction of the domain footprint that lived in conventional,
seizable namespace.

What actually ended it was more human than technical. In October 2020 the
operator, using the handle "JokerStash," posted that he'd contracted COVID-19
and spent a week hospitalized. [Gemini Advisory tracked a "severe decline" in
compromised card volume](https://krebsonsecurity.com/2021/01/jokers-stash-carding-market-to-call-it-quits/)
over the following months: inventory replenishment and forum activity both
degraded in the illness's wake, well before the December seizure attempt.

On 15 January 2021, JokerStash posted the shutdown announcement directly:
retirement, effective 15 February, existing partner balances payable out before
the deadline. The line that closed it out, "we will never ever open again,"
turned out to be true for that name, if not quite for the person behind it.
[Krebs on Security has the full text of the announcement](https://krebsonsecurity.com/2021/01/jokers-stash-carding-market-to-call-it-quits/).

The market noticed. Gemini Advisory tracked the overall value of the stolen
payment-card market falling from roughly $1.9 billion to $1.4 billion in the
year following the shutdown: a real, if partial and temporary, dent in the
carding economy's capacity, not just one storefront closing.

## The name behind the handle

For three and a half years, "JokerStash" stayed exactly that: a handle, not a
person. That changed in September 2024, when the
[Justice Department unsealed an indictment](https://www.justice.gov/usao-edva/pr/two-russian-nationals-charged-connection-operating-billion-dollar-money-laundering)
naming Russian national **Timur Shakhmametov**, also known online as "JokerStash"
and "Vega," as the alleged operator. The charges: conspiracy to commit and aid
bank fraud, conspiracy to commit access device fraud, and conspiracy to commit
money laundering. As with any indictment, these are allegations the government
would have to prove: Shakhmametov has not been convicted of these charges, and
at the time of the announcement remained unlocated. The U.S. State Department's
Transnational Organized Crime Rewards Program offered up to $11 million for
information leading to his arrest.

## Why this is worth a defender's time

Joker's Stash is a retail case study in a supply chain most defenders only ever
see the front end of: the breach notification, the card reissuance, the fraud
alerts. The parts worth carrying forward:

- **Takedown resilience is an infrastructure decision, made in advance.**
  Blockchain DNS wasn't a reaction to the December 2020 seizure; it had been
  load-bearing since 2017. Anything you're defending against that has this
  property should be assumed to survive a single-point takedown; disruption
  strategies aimed at one domain or one server were never going to work here,
  and didn't.
- **The kill switch was operational, not technical.** Six years of law
  enforcement and infrastructure attrition didn't close Joker's Stash. One
  person's illness, and the operational decay that followed it, did. Threat
  actor infrastructure is often more fragile at the human layer than the
  technical one.
- **A card that appears on a dump site is downstream of a breach that already
  happened.** The marketplace is the symptom that's visible; the POS malware
  or skimmer that harvested the data in the first place is the actual point of
  compromise, usually weeks or months earlier. Card monitoring catches fraud;
  it doesn't catch the breach.

## Sources

- [Krebs on Security: Joker's Stash Carding Market to Call it Quits](https://krebsonsecurity.com/2021/01/jokers-stash-carding-market-to-call-it-quits/)
- [Gemini Advisory: Joker's Stash, the Largest Carding Marketplace, Shuts Down](https://geminiadvisory.io/jokers-stash-shuts-down/)
- [Recorded Future / Insikt Group: Joker's Stash Infrastructure Analysis](https://www.recordedfuture.com/research/jokers-stash-infrastructure)
- [U.S. DOJ, Eastern District of Virginia: Two Russian Nationals Charged in Connection with Operating Billion Dollar Money Laundering Services](https://www.justice.gov/usao-edva/pr/two-russian-nationals-charged-connection-operating-billion-dollar-money-laundering)
- [The Hacker News: Joker's Stash Announces Shutdown](https://thehackernews.com/2021/01/jokers-stash-largest-carding.html)
