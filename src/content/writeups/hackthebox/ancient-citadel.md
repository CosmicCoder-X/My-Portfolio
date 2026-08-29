---
title: 'The Ancient Citadel'
target: 'Hack The Box — The Ancient Citadel'
difficulty: 'medium'
date: 2025-08-29
summary: 'An OSINT challenge — given a photo of a stone fortress gate and the hint that it is located in Chile, using Google Lens reverse image search to identify the building as Brunet Castle (Castillo Brunet) in Viña del Mar, confirming the match via Google Street View, and extracting the address from the Google Knowledge Panel to construct the flag in the required format.'
role: 'soc'
tags: ['osint', 'geolocation', 'google-lens', 'reverse-image-search', 'google-maps', 'chile', 'architecture']
problem: 'A photo of a stone fortress with a green arched gate, crenellated walls, and the number 104 visible on the entrance is provided. The challenge description hints the location is somewhere in Chile. The flag format requires the street name, number, exact zip code, city, and region — all separated by underscores.'
action: 'Uploaded the challenge photo to Google Lens for reverse image search. The top results identified the building as Brunet Castle (Castillo Brunet), with matches from travel blogs, Foursquare, and Flickr all pointing to Viña del Mar, Chile. Confirmed the match by comparing Google Street View imagery of the castle gate with the challenge photo — the green arched gate, stone masonry, number 104, and crenellated tower all matched. Extracted the address details from the Google Knowledge Panel, which identified it as The Brunet Castle (also known as Yarur Palace), a historic castle in Viña del Mar, Chile, designed by architect Alfredo Azancot.'
outcome: 'Recovered the flag by formatting the castle address in the required HTB{street_number_exactzipcode_city_with_underscores_region} pattern. The solve was a straightforward reverse image search identification followed by address extraction.'
draft: false
---

## Background

The Ancient Citadel is a geolocation challenge that provides a single photo and narrows the search area to Chile. The challenge description is wrapped in fantasy flavour text about a sorceress in Eldoria, but the core task is simple: identify a building from a photo and return its full address in a specific format.

---

## The challenge image

The provided photo shows a stone fortress gate — grey masonry walls, a green arched iron gate with ornate lattice work, two white columns with carved capitals, a crenellated tower rising above, and the number **104** on a blue plaque beside the entrance. A Google watermark at the bottom suggests this is a Street View capture.

![A stone fortress entrance showing grey masonry walls with a green arched iron gate, two white columns, ornate carved stonework around the arch, a crenellated tower above, the number 104 on a blue plaque, bare trees on either side, and a Google watermark at the bottom.](/writeups/htb-ancient-citadel/01-challenge-image.png)

---

## Reverse image search

Uploading the photo to Google Lens immediately returns matches. The related searches suggest **Brunet Castle** and **Castillo Brunet**, with results from travel blogs about Viña del Mar, Foursquare (162 visitors), and Flickr — all pointing to the same building in Chile, which aligns with the challenge description's hint about "southern kingdoms of Chile".

![Google Lens results showing the uploaded challenge image with related searches for Brunet Castle and Castillo Brunet, matching images from Porque me gusta viajar about Viña del Mar, Foursquare showing Photos at Castillo Brunet with 162 visitors, and Flickr showing Castillo Brunet as one of the most beautiful castles in Viña del Mar.](/writeups/htb-ancient-citadel/02-google-lens-results.png)

---

## Confirming the location

Checking the castle on Google Maps and comparing Street View imagery confirms the match. The wider angle shows the full stone wall facade stretching along the street, the same green arched gate, the crenellated battlements, and the tower — all identical to the challenge photo.

![Google Street View of Brunet Castle showing the full stone facade along the street with the green arched gate visible, crenellated walls, the tower rising above, bare trees lining the sidewalk, and power lines overhead.](/writeups/htb-ancient-citadel/03-brunet-castle-street-view.png)

The Google Knowledge Panel identifies it as **The Brunet Castle**, also known as **Yarur Palace**, a historic castle in **Viña del Mar, Chile**, designed by architect **Alfredo Azancot**. The panel shows 65 Google reviews with a 4.4 rating and provides the address needed for the flag.

![Google Knowledge Panel for The Brunet Castle showing the About section describing it as also known as Yarur Palace, a historic castle in Viña del Mar Chile, with a link to Wikipedia, the address in Chile, architect Alfredo Azancot, and 65 Google reviews with a 4.4 star rating.](/writeups/htb-ancient-citadel/04-google-knowledge-panel.png)

With the address confirmed, the flag was constructed by formatting the street name, number, zip code, city, and region with underscores as specified — matching the example format `HTB{street_number_exactzipcode_city_with_underscores_region}`.

---

## What I took from this

The challenge is a clean exercise in geolocation through reverse image search. Google Lens identified the building on the first attempt, and the confirmation step — comparing Street View imagery against the challenge photo — took seconds. The real skill being tested is less about finding the building and more about extracting the correct address in the exact format the challenge expects. The flag format required precise formatting with underscores, zip codes, and region names, and getting any of those details wrong means a rejected submission even when the location is correct. In geolocation challenges, identifying the place is often the easier half — the harder half is pinning down the exact address details from the right source.
