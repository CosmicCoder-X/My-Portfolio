---
title: 'Searchlight — IMINT'
target: 'TryHackMe — Searchlight — IMINT'
difficulty: 'easy'
date: 2026-08-27
summary: 'An OSINT room focused on image intelligence and geolocation — eight tasks that escalate from reading a street sign to geolocating a hotel from a video, using reverse image search, Google Maps Street View, and cross-platform search engine analysis.'
role: 'soc'
tags: ['OSINT', 'IMINT', 'GEOINT', 'Reverse image search', 'Google Maps', 'Street View', 'Yandex', 'Geolocation']
problem: 'Eight image intelligence challenges of increasing difficulty, starting from identifying a street name on a visible sign and scaling up to geolocating a hotel from a video clip — each requiring a different combination of observation, search technique, and cross-referencing across multiple platforms.'
action: 'Worked through each task using progressive OSINT techniques: direct text extraction from signs and banners, contextual Google searches built from visual clues, reverse image searches across Google, Bing, and Yandex, Google Maps Street View correlation, and Yandex''s image fragment search to isolate and OCR partial text from photographs.'
outcome: 'All eight tasks completed with every question answered, demonstrating the progression from basic observation through multi-platform OSINT tradecraft — culminating in identifying a hotel from a YouTube video by correlating building signage, map positioning, and historical Street View imagery.'
draft: false
---

Searchlight is an introductory IMINT (Image Intelligence) and GEOINT
(Geospatial Intelligence) room that starts simple and builds. The first
task is reading a sign. The last task is identifying a hotel from a
YouTube video by cross-referencing building names, Google Maps angles,
and historical Street View data. What makes it worth writing up isn't the
difficulty — it's the methodology. Each task requires a slightly
different approach, and the room forces you to learn when each technique
works and when it doesn't.

## Task 2 — Your first challenge

The starting point: an image with a clearly visible street sign.

**What is the name of the street where this image was taken?**
**Carnaby Street** — visible directly on the sign in the image. No
searching required, just observation. This is the baseline: before
reaching for any tool, look at what's already in front of you.

## Task 3 — Just Google it

An image of a stairway entrance to an underground station. Rather than
using reverse image search immediately, the approach here was to read
what's visible and build a search query from it.

The image shows European architecture and a sign reading "Circus St..."
above the stairway. Combining the visual clues into a Google search —
`Public Subway Underground Circus Station` — returned the answer
immediately.

**Which city is the tube station located in?** **London**

**Which tube station do these stairs lead to?** **Piccadilly Circus** —
the first Google result was the Wikipedia page, and the "Circus" fragment
on the sign confirmed it.

**Which year did this station open?** **1906** — "Piccadilly Circus tube
station was opened on 10 March 1906, on the Bakerloo line, and on the
Piccadilly line in December of that year."

**How many platforms are there in this station?** **4**

## Task 4 — Keep at it

An image of a building interior with a banner reading "YVR Connects" and
"YVR.CA". The `.CA` domain and `YVR` airport code immediately point to
Canada.

**Which building is this photo taken in?** **Vancouver International
Airport** — searching "YVR Connects" returned the Wikipedia page as the
first result.

**Which country is this building located in?** **Canada**

**Which city is this building located in?** **Richmond** — not Vancouver,
despite the airport's name. The Wikipedia article specifies: "located on
Sea Island in Richmond, British Columbia."

## Task 5 — Coffee and a light lunch

This one required more legwork. The image shows a coffee shop with a
store called "The Edinburgh Woollen Mill" visible across the street.
Searching "The Edinburgh Woollen Mill" alone returns dozens of locations
across the UK — too broad.

The approach that worked: searching `Coffee shops near The Edinburgh
Woollen Mill` narrowed the results to two candidates — "The Wee Coffee
Shop" and "Courtyard Coffee Shop". Google Street View for both locations
confirmed The Wee Coffee Shop as the match.

**Which city is this coffee shop located in?** **Blairgowrie** — the
full address is 1 Allan St, Blairgowrie PH10 6AB, United Kingdom.

**Which street is this coffee shop located in?** **Allan Street**

**What is their phone number?** **+447878839128**

**What is their email address?** **theweecoffeeshop@aol.com** — found on
their Facebook page, linked from the Google Maps business panel. This is
a good reminder that business OSINT often lives on social media pages
linked from the map listing, not on the business's own website.

**What is the surname of the owners?** **Cochrane** — Debbie and David
Cochrane, found by searching "The Wee Coffee Shop Owners".

## Task 6 — Reverse your thinking

No readable text in this image, so reverse image search was the right
first move. Dragging and dropping the image into Google's search bar
immediately returned "Katz's Delicatessen".

**Which restaurant was this picture taken at?** **Katz's Deli**

**What is the name of the Bon Appetit editor that worked 24 hours at
this restaurant?** **Andrew Knowlton** — found by searching "Katz's Deli
Bon Appetit Editor".

## Task 7 — Locate this sculpture

A reverse image search on Google returned a page mentioning "Rudolph the
Chrome Nosed Reindeer" in the URL description. The page contained a map
with markers — clicking the one beneath "TJUVHOLMEN" opened a panel with
the sculpture name and photographer credit.

**What is the name of this statue?** **Rudolph the Chrome Nosed
Reindeer**

**Who took this image?** **Kjersti Stensrud**

## Task 8 — ...and justice for all

This task demonstrated why relying on a single search engine is a
mistake. The image shows a Lady Justice statue with a watermark from The
Verge in the corner.

Google's reverse image search returned "Blind Justice Man" — not useful.
Bing returned "Lady Justice" — correct, but the related images went
cold when trying to find the specific building. Yandex was where the
breakthrough happened: it surfaced a wider-angle related image that
showed partial text on the building — "T V. Bryan United States Court".

Yandex has a feature that Google and Bing don't: **image fragment
search**. Cropping just the text from the related image and searching
that fragment returned the full name of the courthouse and its location.
From there, Google Maps Street View identified the building across the
street.

**What is the name of the character that the statue depicts?** **Lady
Justice**

**Where is this statue located?** **Alexandria, Virginia**

**What is the name of the building opposite from this statue?** **The
Westin Alexandria Old Town**

The lesson here isn't about Lady Justice — it's that different search
engines index and match images differently. Google is strong on text and
brands. Bing does well on objects and scenes. Yandex excels at faces and
architectural features, and its fragment search is a capability the
others simply don't offer. A real IMINT workflow uses all three.

## Task 9 — The view from my hotel room

The hardest task: identify a hotel from a YouTube video. A few seconds
in, a building with the sign "Riverside Point" is visible. Pausing,
screenshotting, and running a reverse image search on Yandex returned a
related image with the location tagged — Singapore.

Searching "Riverside Point Singapore" on Google Maps and comparing the
angle in the video to the map narrowed the recording location to a
specific building across the river. Google Street View's most recent
imagery showed it under construction (as of February 2021), but clicking
through to an entrance of the construction site revealed an older 3D
Street View model from 2018 — before the renovation. That historical
view showed the name "Tanyoto" on the building. Searching "Tanyoto
Singapore Hotel" returned the result: Novotel Clarke Quay.

**What is the name of the hotel that my friend is staying in?**
**Novotel Singapore Clarke Quay**

The technique that made this solvable was Google Maps' historical Street
View data. The current imagery showed a construction site with no
identifying features. The 2018 imagery — accessible by clicking into a
specific entrance — showed the building before renovation with the
pre-construction branding still visible. This is a capability most
people don't know exists: Street View keeps older imagery, and sometimes
the answer to "what is this building?" is "what was this building three
years ago?"

## What I took from this

The room's real lesson is about tool selection. Every task here could
theoretically be solved with a reverse image search, but the fastest
and most reliable approach varied every time. Reading the sign was faster
than any search. Building a contextual query from visual clues
("Public Subway Underground Circus Station") was faster than reverse
image search for the tube station. And the Lady Justice task proved that
the same image returns completely different results on Google, Bing, and
Yandex — if one engine goes cold, switching platforms isn't a fallback,
it's the methodology. The hotel identification task added another
dimension: temporal OSINT, using historical data to identify something
that no longer looks the way it did when it was photographed. That's the
kind of technique that separates an IMINT exercise from a Google search.
