---
title: 'Flag Command'
target: 'Hack The Box — Flag Command'
difficulty: 'easy'
date: 2025-08-29
summary: 'A web challenge — text adventure game with a hidden secret command found by inspecting client-side JavaScript and the /api/options endpoint, bypassing the intended game flow to retrieve the flag.'
role: 'appsec'
tags: ['web', 'javascript', 'devtools', 'source-code-review', 'api-enumeration', 'client-side-logic', 'ctf']
problem: 'A text adventure game where all visible choices lead to dead ends. The flag is behind a secret command not shown in the UI but accepted by the game logic, discoverable through client-side code and API analysis.'
action: 'Explored the web application and checked robots.txt (404). Opened DevTools and identified three JavaScript files powering the game — commands.js, game.js, and main.js. Analysed main.js and found the CheckMessage function, which accepts commands from either the visible options array or a secret array. Traced the secret array to the /api/options endpoint by inspecting Network tab requests, retrieved the JSON response containing all possible commands including the secret phrase, and submitted it in the game terminal.'
outcome: 'Recovered the flag HTB{D3v310p3r_t0015_4r3_b35t_wh4t_y0u_Th1nk??!_77ea2105d8e8213cf3a2ad38e16ca65d} by submitting the secret command "Blip-blop, in a pickle with a hiccup! Shmiggity-shmack" discovered in the /api/options JSON response.'
draft: false
---

## Background

Flag Command is a web challenge built around a text-based adventure game running entirely in the browser. The game presents branching choices at each step, but every visible path leads to a dead end. The actual solution requires reading the client-side JavaScript to discover that the game accepts a hidden command not shown in the UI — a classic case of security through obscurity in client-side logic.

---

## Initial exploration

The application serves a terminal-styled text adventure at the target IP. The intro text sets the scene — an alien forest, a figure muttering "Xclow3n", and a prompt to type `start` to begin.

![The game's opening screen showing flavour text about waking up in a bizarre alien forest, a grinning figure muttering Xclow3n, and a prompt to punch in start to begin.](/writeups/htb-flag-command/01-terminal-intro.png)

Typing `start` presents four directional options: HEAD NORTH, HEAD SOUTH, HEAD EAST, and HEAD WEST.

![The game after typing start — YOU WAKE UP IN A FOREST with four options: HEAD NORTH, HEAD SOUTH, HEAD EAST, HEAD WEST.](/writeups/htb-flag-command/02-start-options.png)

Before playing through the choices, a quick check of `/robots.txt` returns a JSON 404 — nothing useful there.

![Browser showing 94.237.60.78:31547/robots.txt returning a JSON response with message 404 Not Found.](/writeups/htb-flag-command/03-robots-txt-404.png)

---

## Source code analysis

Opening DevTools reveals three JavaScript files driving the game: `commands.js`, `main.js`, and `game.js`.

![The HTML source showing script tags loading commands.js, main.js, and game.js from /static/terminal/js/, followed by an inline module importing startCommander and enterKey from main.js.](/writeups/htb-flag-command/04-devtools-script-tags.png)

The `game.js` file handles display logic — `displayGameResult()` renders win/lose messages using constants imported from `commands.js`, and `playerLost()`/`playerWon()` call it with the appropriate style. Nothing exploitable here.

![The game.js source showing displayGameResult rendering messages with a typing effect, and exported playerLost and playerWon functions calling it with GAME_LOST and GAME_WON constants.](/writeups/htb-flag-command/05-game-js-source.png)

The interesting logic is in `main.js`. The `CheckMessage()` function processes player input by checking if the command exists in either `availableOptions[currentStep]` (the visible choices) **or** `availableOptions['secret']`. Both satisfy the condition to enter the fetch block that sends the command to `/api/monitor` via POST. Inside the response handler, if the server response contains `HTB{`, `playerWon()` fires.

The function also reveals the winning path through the visible options — `HEAD NORTH` sets step 2, `FOLLOW A MYSTERIOUS PATH` sets step 3, `SET UP CAMP` sets step 4 — but following these leads to dead ends.

![The CheckMessage function in main.js showing the conditional that checks both availableOptions at the current step and availableOptions secret, the POST request to /api/monitor, response handling that calls playerWon when the message includes HTB{, and the step progression logic for HEAD NORTH, FOLLOW A MYSTERIOUS PATH, and SET UP CAMP.](/writeups/htb-flag-command/06-main-js-check-message.png)

---

## Finding the secret command

Following the visible options confirms they're dead ends. HEAD NORTH leads to step 2 with new choices, but none of the subsequent branches produce the flag.

![The game after choosing HEAD NORTH — narrative text about stumbling into a clearing with a tavern called The Sloshed Squirrel, followed by four new options: GO DEEPER INTO THE FOREST, FOLLOW A MYSTERIOUS PATH, CLIMB A TREE, TURN BACK.](/writeups/htb-flag-command/07-head-north-options.png)

The key is the `availableOptions['secret']` array referenced in the conditional. The options are fetched from `/api/options` at page load. Checking the Network tab in DevTools shows the `options` request returning a JSON response.

![DevTools Network tab showing multiple fetch requests to monitor, the page document, script files, and the options endpoint returning 803 bytes.](/writeups/htb-flag-command/08-network-tab.png)

The JSON response contains `allPossibleCommands` — arrays for steps 1 through 4 with the visible options, and a `secret` array containing a single entry: **"Blip-blop, in a pickle with a hiccup! Shmiggity-shmack"**.

![The /api/options JSON response showing allPossibleCommands with arrays for steps 1 through 4 containing the visible game options, and a secret array containing the single entry Blip-blop in a pickle with a hiccup Shmiggity-shmack.](/writeups/htb-flag-command/09-api-options-json.png)

---

## Getting the flag

Submitting the secret phrase in the game terminal sends it to `/api/monitor`, which returns the flag.

![The game terminal after submitting the secret command, displaying the flag HTB{D3v310p3r_t0015_4r3_b35t_wh4t_y0u_Th1nk??!_77ea2105d8e8213cf3a2ad38e16ca65d} followed by You escaped the forest and won the game.](/writeups/htb-flag-command/10-flag.png)

---

## What I took from this

The challenge demonstrates why client-side validation is never a security boundary. The game's logic — which commands are valid, which path wins — is entirely in JavaScript that the browser downloads and executes. The "secret" command isn't secret at all; it's fetched from a public API endpoint and stored in a JavaScript variable that anyone with DevTools can read. The `CheckMessage()` function even has the conditional laid out clearly: it checks the secret array right alongside the visible options, making the bypass obvious to anyone who reads the source.

The flag name reinforces the point — **D3v310p3r_t0015_4r3_b35t**. Developer tools are the first thing to reach for on any web challenge, and understanding how client-side JavaScript processes input is often the entire solve. If the game had validated commands server-side without exposing the secret list to the client, this approach wouldn't have worked. But shipping secrets in API responses that the client fetches unconditionally is exactly the kind of mistake that shows up in real applications, not just CTFs.
