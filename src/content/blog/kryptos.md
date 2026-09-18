---
title: "Kryptos: The CIA's Unsolved Statue Just Got Weirder, Not Less"
date: 2026-06-17
summary: "A 10-foot copper sculpture has sat in a CIA courtyard since 1990, carrying four encrypted messages nobody could crack. Three fell in 1999. The fourth survived 35 years of the world's best amateur and professional cryptanalysts, until two journalists found the answer by accident in a filing mistake at the Smithsonian, and it still didn't count as solved."
tags: ['Kryptos', 'CIA', 'Cryptography', 'Puzzles', 'Jim Sanborn']
draft: false
---

There's a sculpture sitting in a courtyard at CIA headquarters in Langley that has spent 35 years doing exactly one thing: making very smart people feel bad about themselves. It's called Kryptos, it's shaped like a sheet of paper curling out of a fax machine, and as of a few months ago its central mystery went through the strangest resolution a puzzle can have. The answer got found. The puzzle didn't get solved. Those turned out to be two completely different things.

## What's actually standing in that courtyard

Kryptos is a 10-foot-tall, S-shaped screen of copper, built by artist **Jim Sanborn** and dedicated at CIA headquarters in 1990. One side carries staggered alphabets; the other carries roughly 2,000 letters cut straight through the metal, arranged into four separate encrypted passages. Sanborn wrote the underlying text himself and worked with a retired CIA cryptographer, **Ed Scheidt**, to actually encode it, meeting in secret and working the ciphers out by hand with pencil and paper before any of it got cut. Sanborn couldn't afford the water-jet cutting a project like that would normally use, so he cut every letter himself with drills and jigsaws, a process that took two and a half years of work in his own studio. ([Scientific American](https://www.scientificamerican.com/article/how-the-cias-kryptos-sculpture-gave-up-its-final-secret/))

Four passages. Sanborn always figured the first three would fall fast and the fourth would be the real test. He was right on both counts, just not in the order or the way anyone expected.

## K1 through K3: solved twice, by two different people, a year apart

The first three sections did come down quickly, encrypted with keyed Vigenère-style ciphers under the keywords **PALIMPSEST** and **ABSCISSA**. K1 reads *"Between subtle shading and the absence of light lies the nuance of iqlusion"*, with "iqlusion" misspelled on purpose, a small deliberate wrongness built right into the first line to mess with anyone assuming clean text. K2 mentions coordinates, an "unknown location," and closes on the line "LAYER TWO," and the initials "WW" inside it are generally read as a nod to **William Webster**, the CIA director who dedicated the sculpture. K3 turns out to be a paraphrase of Howard Carter's own account of the moment he first peered into Tutankhamun's tomb. ([Boxentriq](https://www.boxentriq.com/guides/kryptos-cipher-solutions))

Here's the part that doesn't usually make the short version of this story: those three sections got solved *twice*, a year apart, by two people who had no idea the other had done it. A CIA analyst named **David Stein** broke all three by hand in 1998, spending around 400 hours on it during lunch breaks with nothing but paper and pencil, and he simply wasn't allowed to announce it publicly. A year later, in 1999, computer scientist **Jim Gillogly** broke the same three sections independently using a computer, went public with it immediately, and that public announcement is what forced the CIA to finally admit one of their own had already quietly done it first. ([Wikipedia](https://en.wikipedia.org/wiki/David_Stein))

Which leaves the fourth one.

## K4: 97 characters, and 35 years of nothing

K4 is short: 97 characters of ciphertext, opening with the letters **OBKR**. It has resisted every serious attempt at it since 1990, including from people who broke the first three without much trouble. Over the following decades, Sanborn himself, under some public pressure and a fair amount of his own theatrical reluctance, started handing out single-word clues to keep the thing alive rather than let it go permanently cold:

- **2010**: "BERLIN," positions 64 through 69.
- **2014**: "CLOCK," positions 70 through 74, released with a nudge to "delve into that particular clock," widely read as a pointer to Berlin's Clock, a public sculpture that displays time as a pattern of illuminated lights.
- **January 2020**: "NORTHEAST," positions 26 through 34, publicly billed as the third and supposedly final clue.
- **Spring 2020**: "EAST," positions 22 through 25, released almost accidentally when a solver reached Sanborn directly and got it back as part of his reply, becoming public knowledge by that August anyway. ([NPR](https://www.npr.org/2020/01/30/801323608/a-new-and-final-clue-to-kryptos-a-long-standing-puzzle), [Smithsonian Magazine](https://www.smithsonianmag.com/smart-news/third-and-final-clue-released-ci-sculptures-last-puzzling-passage-180974102/))

Four confirmed words, sitting at four confirmed positions in the ciphertext, straight from the artist. And it still wasn't enough. Thousands of people, working the problem seriously for over three decades with those exact anchors in hand, could not get from four known words to the method that produced the rest of it.

## How it actually ended: not with a solve, with a filing mistake

In September 2025, two journalists, **Jarett Kobek** and **Richard Byrne**, were looking into an upcoming auction of Sanborn's personal archive when they noticed something in the listing: copies of his original coding charts were sitting in the Smithsonian's Archives of American Art, donated years earlier. Byrne went and photographed everything in the folder. Going back through the photos afterward, Kobek realized some of the pages weren't just charts, they were strips of Kryptos's original plaintext, cut apart and taped back together out of sequence.

The strips existed because of a step from 1990 nobody remembers about anymore: before the sculpture went up, Sanborn had to prove to the CIA's own internal review that none of the hidden text was inappropriate or offensive. To do that without simply handing over the solution, he cut his sentences into scrambled strips and taped them down out of order, enough for reviewers to read the content without reading the actual message in sequence. Those strips, unscrambled, are K4's real plaintext. Sanborn had accidentally included copies of them in his own archive donation years earlier, made, by his own account, while he was compiling material during cancer treatment. He confirmed the pages were genuine once Kobek and Byrne brought it to him. ([RR Auction](https://content.rrauction.com/kryptos-k4-discovered-not-solved-heres-what-actually-happened/))

And Sanborn was completely explicit about what this did and didn't mean: *"K4 has not been solved or decrypted."* The plaintext is real and confirmed. The actual cryptographic method, the specific process that turns that plaintext into the ciphertext carved into the copper, is still nobody's but his. Someone found the back of the book. Nobody worked the problem.

## Then it went to auction, on purpose

Sanborn, 80 years old by this point and clearly thinking about what happens to all of this after him, had already planned to auction off his complete Kryptos archive before any of the plaintext turned up, including the original coding system for K4 and a formally announced fifth message, **K5**, that would only be revealed once K4's saga was considered closed. RR Auction ran the sale in November 2025 under the heading "Decoding History: Kryptos K4 & K5, Enigma, and the Rosetta Stone," and the lot went well past its own estimate: pre-sale expectations topped out around $500,000, and it closed at **$962,500**. ([RR Auction](https://content.rrauction.com/jim-sanborns-complete-kryptos-archive-sells-for-962500-at-auction/))

The lot included the original handwritten K4 code, a signed letter from Ed Scheidt, a 12-by-18-inch copper maquette Sanborn submitted to the CIA back in 1988 as a sample, the original signed dedication pamphlet, and the coding charts that started this whole chain of events. The winning bidder stayed anonymous but accepted a new, semi-official title: **Kryptos keeper**. Part of the deal is a private sit-down with Sanborn to go through the codes and charts directly, and a commitment to keep the K4 solution secret rather than publish it, specifically so the puzzle stays alive for everyone still working it the hard way.

## What actually happened here

Pull it apart and Kryptos just went through a resolution that doesn't really have a template. The answer to a 35-year cryptographic mystery exists now, confirmed by the artist himself as genuine, and essentially nobody but one anonymous buyer will ever get to read it, by design. The people who found it weren't cryptanalysts breaking a cipher; they were journalists reading an auction listing closely enough to notice a filing detail nobody else had thought twice about. And the actual cipher, the mathematical or procedural trick that turns Sanborn's plaintext into 97 characters starting with OBKR, is exactly as unbroken today as it was in 1990.

Kryptos was never really a puzzle about cryptography alone. It was a puzzle about a specific person's patience for withholding an answer, and it turns out that even after the plaintext leaked out sideways through an archival accident, that patience hasn't actually run out. Somewhere there's a private buyer who now knows the full story of K4 and K5 both, and the rest of us are exactly where we started: staring at a copper wall, four confirmed words in, still short a method.
