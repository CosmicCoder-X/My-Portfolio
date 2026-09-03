---
title: 'MatchTheRegex'
target: 'picoCTF — MatchTheRegex'
difficulty: 'easy'
date: 2026-07-22
summary: "A picoCTF Web Exploitation challenge where a web page accepted text input validated against a server-side regex. Viewing the page source revealed a commented-out regex hint and a /flag endpoint, and submitting picoCTF matched the pattern and returned the flag."
role: 'appsec'
tags: ['web-exploitation', 'regex', 'javascript', 'source-code-review', 'client-side', 'picoctf']
problem: "A web page with a text input and SUBMIT button under the heading 'Valid Input'. The server validates input against an undisclosed regex pattern, and the objective is to discover the pattern and submit a matching string to retrieve the flag."
action: "Viewed the page source and found a JavaScript send_request() function that fetched /flag?input=${val} and displayed the response via alert(). A commented-out regex hint // ^p....F!? sat right above the fetch call, indicating the server expected input starting with p followed by four characters and F. Submitted picoCTF which matched the pattern and triggered the alert containing the flag."
outcome: "Retrieved the flag picoCTF{succ3ssfully_matchtheregex_9080e406} by inspecting client-side JavaScript source to find the regex hint and endpoint. The challenge demonstrated that sensitive validation logic should never be exposed in client-side code."
draft: false
---

## Background

MatchTheRegex is a picoCTF Web Exploitation challenge built around a simple idea: the server has a regex pattern it wants the input to match, and the clue to that pattern is sitting in the client-side JavaScript source code. The challenge description says "How about trying to match a regular expression" — the question is which regex, and the answer is in the page source. It is a straightforward exercise in viewing source code to extract information the developer left exposed.

---

## The application

The challenge loaded at `saturn.picoctf.net:55529` with a clean, minimal interface: a PicoCTF header bar in orange, a brown heading reading "Valid Input", a text input with placeholder "Input text", and a SUBMIT button. Nothing on the page indicated what kind of input was expected or what the validation rules were.

![PicoCTF web application at saturn.picoctf.net showing an orange header bar with "PicoCTF" in bold, a brown heading "Valid Input", a text input field with placeholder "Input text", and a SUBMIT button.](/writeups/picoctf-matchtheregex/01.png)

Without any visible hints on the rendered page, the natural next step was to look at the source code to understand how the form worked and what happened when the input was submitted.

---

## Reading the source code

Viewing the page source revealed the entire application logic in a `<script>` block at the bottom of the HTML. The `send_request()` function on line 55 handled the form submission: it grabbed the input value from the text field, sent it to the server's `/flag` endpoint as a query parameter via `fetch('/flag?input=${val}')`, parsed the JSON response, and displayed the `flag` field from the response using `alert()`.

![Page source code showing the send_request() JavaScript function: line 56 retrieves the input value with document.getElementById("name").value, line 57 contains the commented-out regex hint // ^p....F!?, line 58 fetches /flag?input=${val}, lines 59-62 parse the JSON response and alert res_json.flag.](/writeups/picoctf-matchtheregex/02.png)

The most important line was 57 — a commented-out regex pattern: `// ^p....F!?`. This was the developer's note about the server-side validation pattern, left in the client-side code where anyone could read it. The regex breaks down as: `^` anchors to the start of the string, `p` matches a literal "p", `....` matches any four characters, `F` matches a literal "F", and `!?` optionally matches an exclamation mark. The pattern was clearly designed around the picoCTF flag format — "picoCTF" starts with "p", has four characters in the middle ("icoC"), and ends near "TF". The hint pointed toward submitting something resembling the picoCTF prefix.

---

## Matching the regex and capturing the flag

Typed `picoCTF` into the input field and clicked SUBMIT. The JavaScript sent the request to `/flag?input=picoCTF`, the server matched the input against its regex, and the response came back with the flag. The browser displayed an alert dialog from `saturn.picoctf.net:55529` containing the flag.

![The PicoCTF application with "picoCTF" typed in the input field and a browser alert dialog from saturn.picoctf.net:55529 displaying the flag: picoCTF{succ3ssfully_matchtheregex_9080e406}.](/writeups/picoctf-matchtheregex/03.png)

`picoCTF{succ3ssfully_matchtheregex_9080e406}`

---

## What I took from this

MatchTheRegex is one of the simpler web challenges, but the lesson it teaches is fundamental: never expose server-side logic in client-side code. The regex pattern that governed the server's input validation was sitting in a JavaScript comment — one "View Source" away from anyone. In this challenge the exposure was a regex, but the same mistake shows up in real applications with API keys, internal endpoint paths, authentication logic, debug flags, and admin URLs left in JavaScript files that ship to the browser. The fix is straightforward: keep all validation logic and sensitive patterns on the server, serve only the minimal client-side code needed for the user interface, and strip comments and debug code from production builds. Tools like webpack, esbuild, and other bundlers can minify and tree-shake JavaScript to remove dead code and comments, but the real defence is architectural — sensitive logic should never be written into client-side code in the first place, regardless of whether it gets minified later.
