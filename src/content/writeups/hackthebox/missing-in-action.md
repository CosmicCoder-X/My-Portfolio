---
title: 'Missing in Action'
target: 'Hack The Box — Missing in Action'
difficulty: 'easy'
date: 2025-08-29
summary: 'An OSINT challenge — tracing Roland Sanchez across social media. LinkedIn reveals his employer Egotistical Bank, the company Twitter references Foursquare, and a Google dork finds his Foursquare profile with the flag hidden in a cafe review.'
role: 'soc'
tags: ['osint', 'social-media', 'linkedin', 'twitter', 'foursquare', 'google-dorks', 'reconnaissance', 'open-source-intelligence']
problem: 'Roland Sanchez from Birmingham, UK is missing. Trace his digital footprint across social media platforms using only public information to find the flag.'
action: 'DuckDuckGo search found his LinkedIn profile as CISO at Egotistical Bank. The company Twitter @BankEgotistical referenced @FoursquareGuide for branch locations. Google dork "Roland Sanchez" site:foursquare.com located his Foursquare profile with the flag in a cafe review at Tamper at Sellers Wheel, Sheffield.'
outcome: 'Flag HTB{J4Va_c0St_M3_m0r3_than_1_th0ugh7} recovered from a Foursquare cafe review. OSINT chain: LinkedIn to Twitter to Foursquare.'
draft: false
---

## Background

Missing in Action is an OSINT challenge that tests the ability to trace a person's digital footprint across multiple social media platforms. The challenge description gives a name, a city, and a reason to investigate — Roland Sanchez from Birmingham, UK, reportedly missing during a business trip. The solve requires following breadcrumbs from one platform to the next.

---

## LinkedIn — identifying the employer

Searching for "Roland Sanchez Birmingham UK" on DuckDuckGo immediately surfaces a LinkedIn profile.

![DuckDuckGo search results for Roland Sanchez Birmingham UK showing the first result as Roland Sanchez - CISO - Egotisical Bank on LinkedIn, located in Birmingham, England, United Kingdom.](/writeups/htb-missing-in-action/01-duckduckgo-linkedin.png)

The profile confirms Roland Sanchez is the **CISO at Egotistical Bank**, based in Birmingham, England. This gives us the company name to pivot on.

![Roland Sanchez LinkedIn profile showing his role as CISO at Egotistical Bank, located in Birmingham, Inglaterra, with 53 followers and the Egotisical Bank company page linked.](/writeups/htb-missing-in-action/02-linkedin-profile.png)

---

## Twitter — following the company trail

Searching for Egotistical Bank leads to the company's Twitter account **@BankEgotistical**. Scrolling through their tweets, one from April 2020 mentions that once the pandemic is over, they'll be opening new branches and directs followers to check **@FoursquareGuide** for locations.

![The @BankEgotistical Twitter profile showing 11 tweets, the bio "We like money! YOUR MONEY!", and a tweet from April 2020 mentioning new branches and directing to @FoursquareGuide for locations.](/writeups/htb-missing-in-action/03-twitter-egotistical-bank.png)

This is the pivot — the company is connected to Foursquare, a location-based social platform where users leave reviews and check-ins at venues.

![The @FoursquareGuide Twitter profile showing it as the verified Foursquare City Guide account with 552.2K followers and a link to foursquare.com.](/writeups/htb-missing-in-action/04-twitter-foursquare.png)

---

## Foursquare — finding the flag

Navigating to foursquare.com confirms it's a location technology platform where users can list businesses, find places, and leave reviews.

![The Foursquare homepage showing three options — List My Business, Find a Business, and Our Location Platform.](/writeups/htb-missing-in-action/05-foursquare-website.png)

Using a Google dork to search specifically for Roland Sanchez on the Foursquare domain — `"Roland Sanchez" site:foursquare.com` — surfaces his profile directly. His recent tips section shows a review of **Tamper at Sellers Wheel**, a cafe in Sheffield, UK, with the flag embedded at the end of the review text.

![Roland Sanchez Foursquare profile showing a review of Tamper at Sellers Wheel cafe in Sheffield, UK — the review text reads Excellent place to go for a nice chilled out coffee Good french toast too The place is easy to get to within walking distance of the train station followed by HTB{J4Va_c0St_M3_m0r3_than_1_th0ugh7}, posted May 13 2020.](/writeups/htb-missing-in-action/06-foursquare-flag.png)

The dork search also previews the flag directly in the search results, confirming it without even visiting the page.

![DuckDuckGo search results for Roland Sanchez site:foursquare.com showing the first result as Roland Sanchez on Foursquare with the review text and HTB{J4Va_c0St_M3_m0r3_than_1_th0ugh7} visible in the snippet.](/writeups/htb-missing-in-action/07-dork-flag-search.png)

---

## What I took from this

The challenge is a clean exercise in social media pivoting — the technique of using information found on one platform to locate accounts on another. LinkedIn gave the employer name, the employer's Twitter gave the connection to Foursquare, and Foursquare held the flag. Each platform contributed one piece of the chain, and missing any link would have stalled the investigation.

The Google dork at the end — `"Roland Sanchez" site:foursquare.com` — is worth highlighting because it's often faster than navigating a platform's own search. Foursquare's internal search is designed for finding venues, not users, so using a search engine with the `site:` operator to search within Foursquare's indexed pages is the more effective approach. In real OSINT work, the same technique applies to any platform: when the site's search doesn't support what you're looking for, use a search engine that has already crawled and indexed it.
