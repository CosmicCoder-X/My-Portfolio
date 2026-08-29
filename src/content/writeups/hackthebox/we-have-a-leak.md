---
title: 'We Have A Leak'
target: 'Hack The Box — We Have A Leak'
difficulty: 'medium'
date: 2025-08-29
summary: 'An OSINT challenge — starting with nested password-protected zip files (outer password hackthebox), pivoting to the Twitter account @SuperSecStartup to enumerate employees, finding the username j.terranwald from a tweet welcoming a new hire, finding the password pattern SupSecStart#Winter2018! on a whiteboard in an employee photo, modifying the season to Spring2019 based on the hire date to unlock the final zip, and recovering the flag from flag.txt.'
role: 'soc'
tags: ['osint', 'twitter', 'employee-enumeration', 'social-media', 'password-cracking', 'zip-files', 'credential-exposure', 'social-engineering', 'reconnaissance']
problem: 'A zip file named We Have a Leak.zip is provided with the password hackthebox. Inside is a nested structure of password-protected zips — mock_ssh_login.zip contains username.zip, which contains password.zip, which contains flag.txt. The passwords for the inner zips are unknown and must be discovered through OSINT on the fictional company Super Secure Startup.'
action: 'Extracted the outer zip with the password hackthebox, revealing mock_ssh_login.zip containing username.zip. The inner zip was password protected with no hints in the file structure. Searched Twitter for the company Super Secure Startup and found @SuperSecStartup. Enumerated employees through tweet replies — Johanna Boyce (@boyce_johanna) revealed her email j.boyce@supersecurestartup.com, Alia Mccarty (@mccarty_alia) replied asking about CVs, and Bianka Phelps (@BiankaPhelps) posted a whiteboard photo containing the SSH default password SupSecStart#Winter2018!. A welcome tweet for @JTerranwald as the new lead Web Developer dated March 26, 2019 provided the username j.terranwald. The password was derived by modifying the season and year from the whiteboard — Winter2018 to Spring2019 — matching the hire date.'
outcome: 'Recovered the flag HTB{Sav3_The_Startup_Sav3_The_W0rld_#Hiro} from flag.txt inside the final nested zip. The solve required combining file-based clues (nested zip structure implying SSH credentials) with social media OSINT (employee enumeration, credential exposure in photos, and date-based password rotation logic).'
draft: false
---

## Background

We Have A Leak combines file forensics with social media OSINT — a nested structure of password-protected zip files that can only be unlocked by investigating the company they belong to. The challenge is built around a fictional startup called Super Secure Startup, and the passwords for the inner zips aren't brute-forceable. They have to be discovered by enumerating employees on Twitter, finding credentials accidentally exposed in photos, and reasoning about password rotation patterns based on employee timelines. The challenge was created by greenwolf — the same creator behind Infiltration, and some of the same characters (Alia Mccarty) appear in both.

---

## The nested zip structure

The challenge provides `We Have a Leak.zip` with the password `hackthebox`. Extracting it reveals a directory `we_have_a_leak/` containing `mock_ssh_login.zip`. Inside that is `username.zip`, which is password protected — attempting to unzip it without the correct password fails.

![Kali terminal running unzip on We Have a Leak.zip with the password hackthebox, extracting the directory we_have_a_leak and inflating mock_ssh_login.zip inside it.](/writeups/htb-we-have-a-leak/01-unzip-outer.png)

The directory structure itself is a clue. The path `mock_ssh_login/username/password/flag.txt` tells us that the zip passwords correspond to SSH credentials — `username.zip` needs a username as its password, and `password.zip` inside it needs the corresponding password. Both have to come from somewhere outside the zip file.

![Kali terminal in the mock_ssh_login directory showing username.zip, then running unzip on username.zip which prompts for a password and fails with incorrect password, skipping username/password.zip.](/writeups/htb-we-have-a-leak/02-username-zip-locked.png)

---

## Twitter — finding the company

The challenge name and the company name "Super Secure Startup" point to social media. Searching Twitter for the company leads to **@SuperSecStartup** — a blue padlock logo, the bio "We're a new startup looking to shake up the industry. Venture Capital funded & looking to hire all kinds of IT professionals", joined March 2019, with 3 following and 123 followers.

![Twitter profile of Super Secure Startup @SuperSecStartup showing a blue padlock logo, the bio about being a new VC-funded startup hiring IT professionals, joined March 2019, 3 Following and 123 Followers.](/writeups/htb-we-have-a-leak/03-twitter-supersecstartup.png)

The account follows 3 people — those are the employees to enumerate. The company's tweets and the replies underneath them are where the credentials are hiding.

---

## Employee enumeration

The company's first tweet announces their new Bay Area office: "We just opened up our new office in the downtown Bay Area" with hashtags #woke #ChangingTheWorld #TechPower, posted March 25, 2019. The replies are where it gets interesting.

**Alia Mccarty** (@mccarty_alia) — the same character from the Infiltration challenge — replies asking "@SuperSecStartup how do I send you a CV?". **Johanna Boyce** (@boyce_johanna) responds with her email: **j.boyce@supersecurestartup.com**. This confirms the email format and gives us a named employee, but more importantly, the reply thread reveals the company's social circle.

![Tweet from Super Secure Startup about opening a new Bay Area office with a photo of an open-plan workspace, followed by replies — Alia Mccarty asking how to send a CV, and Johanna Boyce replying with her email j.boyce@supersecurestartup.com.](/writeups/htb-we-have-a-leak/04-bay-area-tweet-replies.png)

Johanna Boyce also posts her own tweet the next day — "Our new office is done at last! Thanks to everyone who helped make it a reality!" — with a floor plan of the office. The floor plan is a distraction for this challenge, but in a real engagement it would be valuable for physical security assessments.

![Tweet from Johanna Boyce @boyce_johanna dated March 26 2019 reading Our new office is done at last Thanks to everyone who helped make it a reality, with an attached black and white architectural floor plan showing multiple rooms, a staircase, and furniture layouts.](/writeups/htb-we-have-a-leak/05-johanna-floor-plan.png)

---

## The username — J. Terranwald

The company account posts a welcome tweet on **March 26, 2019**: "We're super excited to welcome @JTerranwald to the team, he will be joining our San Francisco based team next week as our new lead Web Developer." The tweet has 21 likes.

![Tweet from Super Secure Startup dated March 26 2019 reading We are super excited to welcome @JTerranwald to the team he will be joining our San Francisco based team next week as our new lead Web Developer, with 21 likes.](/writeups/htb-we-have-a-leak/06-jterranwald-welcome.png)

The zip file is named `username.zip` and sits inside `mock_ssh_login`. The SSH username for a new employee would follow a standard corporate convention — first initial, dot, last name: **j.terranwald**. Using this as the password for `username.zip` extracts successfully, revealing `password.zip` inside.

---

## The password — whiteboard exposure

The third employee in the company's following list is **Bianka Phelps** (@BiankaPhelps). Her tweet reads "Ours nerds are working hard today!" with a nerd emoji and a photo of someone standing in front of a whiteboard covered in business diagrams and notes.

![Tweet from Bianka Phelps @BiankaPhelps reading Ours nerds are working hard today with a nerd emoji, showing a photo of a man in a suit standing in front of a large whiteboard covered in handwritten business diagrams, flowcharts, and notes.](/writeups/htb-we-have-a-leak/07-bianka-whiteboard.png)

The whiteboard looks like typical startup brainstorming at first glance — flowcharts, "CONCEPT", "TEAM", "PRODUCT", "INTERNET", revenue figures. But in the lower-left corner, partially obscured by other notes, is something that doesn't belong on a whiteboard photo posted to social media:

**SSH DEFAULT PW**
**SupSecStart#Winter2018!**

![Zoomed crop of the whiteboard lower-left corner showing the text SSH DEFAULT PW above the password SupSecStart#Winter2018! in bold handwriting.](/writeups/htb-we-have-a-leak/08-whiteboard-zoom-ssh.png)

This is the company's default SSH password — written on a whiteboard, photographed, and posted publicly by an employee who didn't notice what was in the frame. A textbook credential exposure through social media.

---

## Password rotation — Winter to Spring

Using `SupSecStart#Winter2018!` as the password for `password.zip` doesn't work. The password is correct in format but wrong in the details — and the JTerranwald welcome tweet provides the clue to fix it.

The whiteboard password is from **Winter 2018**. JTerranwald was welcomed on **March 26, 2019** — that's spring. If the company rotates their default SSH password seasonally (changing the season and year), then by the time JTerranwald joined, the password would have rotated from Winter2018 to **Spring2019**.

The password for `password.zip`: **SupSecStart#Spring2019!**

This extracts successfully, revealing `flag.txt`.

---

## The flag

```
# cat flag.txt
HTB{Sav3_The_Startup_Sav3_The_W0rld_#Hiro}
```

![Kali terminal in the mock_ssh_login/username/password directory showing flag.txt from ls, then cat flag.txt outputting HTB{Sav3_The_Startup_Sav3_The_W0rld_#Hiro}.](/writeups/htb-we-have-a-leak/09-flag.png)

---

## What I took from this

The challenge is a realistic simulation of how social media OSINT feeds into credential discovery. Every piece of the puzzle comes from employees posting things that seem harmless in isolation — a reply with an email address, a welcome tweet for a new hire, a whiteboard photo. None of those tweets were intended to leak credentials, but combined together they provide a username and a password pattern that unlocks access.

The password rotation logic is the most interesting part. The whiteboard gives you a password that's close but outdated, and the hire date gives you the information to age it forward. This mirrors real-world password policies where organisations use predictable seasonal or quarterly rotation schemes — CompanyName#Season+Year is a pattern that shows up regularly in breach data and password spray lists. If an attacker knows the pattern and can determine the current rotation period, they can predict the active password without ever seeing it directly.

The accidental credential exposure through photos is worth highlighting separately. Bianka Phelps didn't post the whiteboard to share the SSH password — she posted it to show her colleagues working. The password was background noise she didn't notice. In real security assessments, employee social media photos are a known source of sensitive information — whiteboards with credentials, monitors showing internal applications, badges with access codes, sticky notes with passwords. The OPSEC failure isn't in having the password on the whiteboard; it's in photographing the whiteboard and posting it publicly without checking what's in the frame.
