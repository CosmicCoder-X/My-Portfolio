---
title: 'Money Flowz'
target: 'Hack The Box — Money Flowz'
difficulty: 'medium'
date: 2025-08-29
summary: 'An OSINT challenge — tracing Frank Vitalik from Reddit to a Steemit fake ETH giveaway, pivoting to the Ropsten testnet via a comment hint, and decoding hex input data from an outgoing transaction to reveal the flag.'
role: 'soc'
tags: ['osint', 'reddit', 'steemit', 'ethereum', 'ropsten', 'etherscan', 'blockchain', 'cryptocurrency', 'transaction-analysis', 'hex-decoding']
problem: 'Starting point is the name Frank Vitalik and a crypto implication. The flag is hidden somewhere in the trail of his financial activity across social media and blockchain.'
action: 'Found Reddit u/frankvitalik with a post linking to a Steemit fake ETH giveaway at steemit.com/htb/@freecoinz/freecoinz with wallet 0x1b3247Cd0A59ac8B37A922804D150556dB837699. A self-reply comment mentioned "ropsten net", pointing to the Ropsten testnet. Looked up the address on ropsten.etherscan.io -- 125 incoming transactions, only 2 outgoing. The Input Data field of one outgoing transaction contained hex that decoded to the flag.'
outcome: 'Flag HTB{CryPt0Curr3ncy_1s_FuNz!!} recovered from hex-encoded Input Data in a Ropsten testnet transaction. OSINT chain: Reddit to Steemit to blockchain analysis.'
draft: false
---

## Background

Money Flowz is an OSINT challenge that bridges social media investigation with blockchain analysis. The starting point is a name — Frank Vitalik — and a hint about money. The solve requires following a trail from Reddit to Steemit to the Ethereum blockchain, recognising that the relevant network is a testnet rather than mainnet, and knowing where to look inside a transaction for hidden data.

---

## Reddit — the starting point

Searching for "Frank Vitalik" leads to the Reddit account **u/frankvitalik**. The profile has a karma of 21, a cake day of May 23, 2020, and two posts. The first is a repost of a thread from r/CryptoCurrency about the cleverest crypto scams — a post by u/poopymcpoppy12 describing a scammer who "accidentally leaks" a private key to an Ethereum wallet containing worthless ERC20 tokens, baiting people into sending ETH for gas fees that gets immediately swept by a script.

The second post is the lead: **"Incredible SCAM giveaway! you can get free coins!"** with a link to `https://steemit.com/htb/@freecoinz/freecoinz`.

![Reddit profile of u/frankvitalik showing karma 21, cake day May 23 2020, Two-Year Club and Verified Email trophies, a repost of the cleverest crypto scam thread from r/CryptoCurrency, and a post titled Incredible SCAM giveaway linking to steemit.com/htb/@freecoinz/freecoinz.](/writeups/htb-money-flowz/01-reddit-frankvitalik.png)

---

## Steemit — the fake giveaway

Following the link leads to a Steemit post by the **freecoinz** account titled "Freecoinz!!" — a deliberately obvious fake Ethereum giveaway. The post claims "Deposit 10X ETH to this address and get 20X ETH back!!" and provides the Ethereum address **0x1b3247Cd0A59ac8B37A922804D150556dB837699**.

![Steemit page at steemit.com/htb/@freecoinz/freecoinz showing the title Freecoinz, the heading Super Ethereum SCAM Giveaway, the text Deposit 10X ETH to this address and get 20X ETH back, the Ethereum address 0x1b3247Cd0A59ac8B37A922804D150556dB837699, and a Powered by Ethereum logo.](/writeups/htb-money-flowz/02-steemit-freecoinz-top.png)

The critical clue is in the comments. The freecoinz account left a self-reply: **"Wow! I can't believe they are giving free coins into the ropsten net!"** — this comment is the pivot. It tells us the wallet address isn't on the Ethereum mainnet but on the **Ropsten testnet**, a now-discontinued test network where ETH has no real-world value.

![The same Steemit page scrolled down showing the comment from freecoinz reading Wow I can not believe they are giving free coins into the ropsten net, with a red arrow pointing to the comment text.](/writeups/htb-money-flowz/03-steemit-freecoinz-comment.png)

---

## Ropsten Etherscan — following the money

Navigating to `ropsten.etherscan.io` and searching for the wallet address reveals 125 transactions — people (or bots) sending small amounts of test ETH to the scam address. The balance shows $0.00 in tokens, and the transaction list is all incoming transfers of various amounts.

![Ropsten Etherscan showing the address page for 0x1b3247Cd0A59ac8B37A922804D150556dB837699 with 125 total transactions, balance info unavailable, Token $0.00, and a list of incoming Transfer transactions with values ranging from 0 to 0.8 Ether.](/writeups/htb-money-flowz/04-etherscan-address.png)

The challenge name is "Money Flowz" — the question is where the money goes *out*. Filtering for outgoing transactions reveals only **2 OUT transactions**, both sent to the same destination address `0x64d8e29f428f9a34270...` within the same timeframe (963 days ago, blocks 7840635 and 7840645). One sent 0.99 Ether and the other sent 0 Ether.

![Ropsten Etherscan filtered for outgoing transactions showing 2 OUT transactions found — 0xc9dc91514cd66e1bb0 in block 7840645 for 0 Ether, and 0xe1320c23f292e52090 in block 7840635 for 0.99 Ether, both to the same destination address.](/writeups/htb-money-flowz/05-etherscan-outgoing-txns.png)

---

## Transaction input data — finding the flag

Inspecting the first outgoing transaction (0.99 Ether, block 7840635) reveals something in the **Input Data** field — a hex string that doesn't belong to a standard ETH transfer. Normal Ether transfers have empty input data; this one contains `0x4854427b43727950743043757272336e63795f31735f46754e7a21217d`.

![Ropsten Etherscan transaction detail for 0xe1320c23f292e52090 showing a Ropsten Testnet transaction, Status Success, Block 7840635, Timestamp May-04-2020, Value 0.99 Ether, and Input Data containing hex string 0x4854427b43727950743043757272336e63795f31735f46754e7a21217d with a red arrow pointing to the Input Data field.](/writeups/htb-money-flowz/06-transaction-hex-input.png)

The second outgoing transaction (0 Ether, block 7840645) makes it even clearer — its Input Data field contains the flag directly in plaintext, visible when viewed as UTF-8: **HTB{CryPt0Curr3ncy_1s_FuNz!!}**.

![Ropsten Etherscan transaction detail for 0xc9dc91514cd66e1bb0 showing a Ropsten Testnet transaction, Status Success, Block 7840645, Timestamp May-04-2020, Value 0 Ether, and Input Data showing the flag HTB{CryPt0Curr3ncy_1s_FuNz!!} in plaintext.](/writeups/htb-money-flowz/07-transaction-flag.png)

The hex in the first transaction decodes to the same flag — `4854427b` is `HTB{` in ASCII, and the rest follows. Both transactions carry the flag; one encoded as raw hex bytes, the other rendered directly as UTF-8.

---

## What I took from this

The challenge is a clean introduction to blockchain OSINT — following a trail from traditional social media into on-chain analysis. The key skills are recognising that the Steemit comment about "ropsten net" points to a specific Ethereum testnet rather than mainnet, knowing that Etherscan has separate explorers for different networks, and understanding that Ethereum transactions can carry arbitrary data in their Input Data field beyond just the transfer itself.

The Input Data field is worth highlighting because it's often overlooked. In a standard ETH transfer, this field is empty. In contract interactions, it contains the encoded function call. But it can also be used to embed arbitrary messages — and in blockchain forensics, this is a known technique for encoding messages permanently on-chain. The challenge demonstrates this in a CTF context, but the same principle applies to real investigations: transaction metadata can carry information that isn't visible in the value, sender, or recipient fields alone.

The distinction between mainnet and testnet is also important. If you search for this address on the regular etherscan.io (mainnet), you'll find nothing — or a completely different address with different activity. The Ropsten testnet was a separate network with its own block explorer, its own transactions, and its own ETH that had no monetary value. Recognising which network to investigate is a fundamental step in any blockchain OSINT task, and the Steemit comment was the only breadcrumb pointing there.
