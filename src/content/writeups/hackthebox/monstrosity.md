---
title: 'Monstrosity'
target: 'Hack The Box — Monstrosity'
difficulty: 'medium'
date: 2025-08-29
summary: 'An OSINT challenge — investigating a Twitter account @miounster with 3,000 identical growling tweets, using DevTools to extract the user ID from the Twitter API, fetching all tweets via the Twitter API v2 with Bearer token authentication and pagination, running a Python script to filter geo-tagged tweets and plot their coordinates with matplotlib, reading the resulting MD5 hash 407180F14EBB5D998E0083034ED9A21B from the plot, and cracking it on CrackStation to recover the flag.'
role: 'soc'
tags: ['osint', 'twitter', 'twitter-api', 'geo-coordinates', 'matplotlib', 'python', 'md5', 'hash-cracking', 'crackstation', 'api-enumeration', 'pagination']
problem: 'A Twitter account @miounster has posted exactly 3,000 tweets, all containing variations of "Gggggrrrrr". The tweets appear identical at first glance, but some contain embedded geo-coordinate metadata. The task is to extract all tweets, identify the ones with location data, and decode the hidden message formed by the coordinates.'
action: 'Visited the @miounster Twitter profile and observed 3,000 tweets of identical growling content. Opened DevTools Network tab and intercepted the UserByScreenName API request to extract the account rest_id 885213010314317825. Used the Twitter API v2 with Bearer token authentication to fetch all 3,000 tweets with pagination, filtering for tweets containing geo-coordinate fields. Ran a community analysis script (analyze.py) to extract and plot the coordinates using matplotlib, which rendered the MD5 hash 407180F14EBB5D998E0083034ED9A21B as text on a scatter plot. Submitted the hash to CrackStation, which identified it as md5 and cracked it to the plaintext covertops.'
outcome: 'Recovered the flag HTB{covertops} by cracking the MD5 hash 407180F14EBB5D998E0083034ED9A21B revealed through geo-coordinate plotting. The OSINT chain moved from Twitter profile enumeration through API data extraction to coordinate visualisation and hash cracking.'
draft: false
---

## Background

Monstrosity is an OSINT challenge that hides its data in plain sight — across 3,000 tweets that all look the same. The Twitter account @miounster posts nothing but variations of "Gggggrrrrr", and the sheer volume of identical content is designed to make manual inspection impossible. The solve requires pulling every tweet through the Twitter API, identifying which ones carry geo-coordinate metadata, and plotting those coordinates to reveal a hidden message.

---

## The Twitter account

The @miounster profile is a pink monster avatar with a "Lil' Badass" banner and the bio "I scare because i care". It has exactly 3,000 tweets, 0 following, 110 followers, and a YouTube link. Every visible tweet is some variation of "Gggggrrrrr" with heart emojis — scrolling through them manually reveals nothing useful.

![The @miounster Twitter profile showing 3,000 tweets, a pink monster avatar, a Lil Badass banner, the bio I scare because i care, a YouTube link, 0 following and 110 followers, with visible tweets all containing variations of Gggggrrrrr followed by heart emojis.](/writeups/htb-monstrosity/01-twitter-miounster-profile.png)

The interesting part isn't in the tweet text — it's in the metadata. Some of these 3,000 tweets have geo-coordinates attached, and those coordinates spell something out when plotted.

---

## Extracting the user ID

To pull tweets from the Twitter API, the account's numeric user ID is needed rather than the screen name. Opening DevTools on the profile page and filtering the Network tab for XHR requests shows a GET request to `UserByScreenName` on `api.twitter.com`. The JSON response contains the account's `rest_id`: **885213010314317825**.

![DevTools Network tab on the @miounster profile showing XHR requests to api.twitter.com, with the UserByScreenName GET request selected and the Response tab displaying the JSON result object containing __typename User, a base64 id, and rest_id 885213010314317825.](/writeups/htb-monstrosity/02-devtools-twitter-api.png)

With the user ID in hand, the Twitter API v2 can be used to fetch the account's tweets programmatically, including any geo-coordinate metadata that isn't visible in the browser UI.

---

## Fetching tweets and extracting coordinates

Fetching 3,000 tweets requires the Twitter API v2 with Bearer token authentication. The API returns tweets in pages, so a `pagination_token` from each response is used to request the next batch until all tweets are retrieved. The key is requesting the `geo.coordinates` tweet field — without explicitly asking for it, the API omits location data from the response.

Rather than writing the extraction and plotting logic from scratch, I used [7Rocky's analyze.py](https://github.com/7Rocky/HackTheBox-scripts/blob/main/Challenges/OSINT/Monstrosity/analyze.py) — a community script for this challenge, the same way you'd reach for a pentest monkey reverse shell payload instead of writing your own. The script handles the API pagination, filters tweets that contain geo-coordinate data, and plots the latitude and longitude values as a scatter plot using matplotlib.

---

## The hidden message

Running the script and plotting the coordinates produces a scatter plot with red dots concentrated in a narrow horizontal band around y = -55 on a -200 to 200 grid. Zoomed out, the dots look like a line of text that's too small to read.

![Matplotlib scatter plot on a -200 to 200 grid showing red dots forming a line of text concentrated around y equals negative 55, too small to read at this zoom level.](/writeups/htb-monstrosity/03-matplotlib-plot-zoomed-out.png)

Zooming in on the cluster reveals the dots spell out an MD5 hash: **407180F14EBB5D998E0083034ED9A21B**. Each character is formed by individual coordinate points plotted at precise positions — the geo-coordinates in the tweets were set deliberately to render this text when visualised.

![Matplotlib scatter plot zoomed in showing red dots clearly forming the text 407180F14EBB5D998E0083034ED9A21B, with each character rendered as a dot-matrix pattern between y equals negative 50 and negative 65.](/writeups/htb-monstrosity/04-matplotlib-plot-md5-hash.png)

---

## Cracking the hash

The 32-character hex string is clearly an MD5 hash. Submitting it to CrackStation returns an exact match — hash type **md5**, plaintext result **covertops**.

![CrackStation showing the hash 407180F14EBB5D998E0083034ED9A21B in the input field, with the results table below identifying it as md5 type with the cracked result covertops highlighted in green as an exact match.](/writeups/htb-monstrosity/05-crackstation-result.png)

The flag: **HTB{covertops}**

---

## What I took from this

The challenge is a good example of steganography through metadata — the message isn't hidden in the tweet content but in the coordinates attached to it. Looking at any individual tweet shows nothing: the text is gibberish and the geo-coordinates are just numbers. The information only becomes visible when all 3,000 tweets are collected and the coordinates are plotted together. It's a reminder that metadata can carry as much signal as content, and that automated extraction and visualisation are sometimes the only way to see what's there.

The Twitter API v2 pagination is worth noting as a practical skill. Many API-based OSINT tasks require fetching large datasets that come back in pages, and understanding how `pagination_token` works — requesting the next page using the token from the previous response until no more tokens are returned — is fundamental to working with any paginated API, not just Twitter's. The Bearer token authentication pattern is equally common across modern APIs.

The hash cracking step at the end is almost trivial — CrackStation's rainbow tables handle simple MD5 hashes instantly — but it ties the challenge together. The difficulty isn't in any single step; it's in recognising that the geo-coordinates are the data channel, that plotting them is the decode method, and that the resulting string needs one more transformation before it becomes the flag.
