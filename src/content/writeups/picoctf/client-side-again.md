---
title: 'Client-side-again'
target: 'picoCTF — Client-side-again'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where an obfuscated JavaScript verify function checked the password against hardcoded substrings stored in a shuffled array, and deobfuscating the code revealed the flag assembled from those fragments.'
role: 'appsec'
tags: ['web-exploitation', 'javascript', 'obfuscation', 'client-side', 'reverse-engineering', 'picoctf']
problem: 'A login page at jupiter.challenges.picoctf.org with a password field and a verify button. The validation logic is in obfuscated client-side JavaScript that checks the input against hardcoded string fragments.'
action: 'Inspected the page source, pretty-printed the obfuscated JavaScript, identified the string array and the verify function, decoded the array references and substring checks, and reconstructed the flag from the fragments.'
outcome: 'Retrieved the flag by reading it directly from the deobfuscated client-side validation code.'
draft: false
---

## Background

Client-side-again is a picoCTF Web Exploitation challenge about JavaScript obfuscation. The challenge hint is a single word: "What is obfuscation?" The application performs password validation entirely in the browser using JavaScript — no server-side check at all. The JavaScript is obfuscated with a shuffled string array and hex-indexed references, but since the code runs in the browser, everything needed to extract the password is delivered to the client.

---

## The login page

The challenge URL loaded a stark page with a barbed wire background image, a grey login box titled "New and Improved Login" with the text "Enter valid credentials to proceed", a single password input field, and a verify button.

![Login page at jupiter.challenges.picoctf.org/problem/60786/ showing a greyscale barbed wire background with a grey overlay box in the centre containing the text "New and Improved Login" and "Enter valid credentials to proceed", a small password input field, and a verify button.](/writeups/picoctf-client-side-again/01.png)

No username field, no hints on the page itself. The validation had to be happening somewhere in the JavaScript.

---

## Inspecting the obfuscated JavaScript

Opened DevTools with F12 and navigated to the Sources tab. The page loaded a single JavaScript block embedded in the HTML. The code was minified into a dense single line, so the first step was clicking the pretty-print button (`{}` at the bottom of the source panel) to reformat it into readable, indented code.

![DevTools Sources tab showing the pretty-printed JavaScript code. The script contains a var _0x5a46 array with string values including 'f49bf}', '_again_e', 'this', 'Password Verified', 'Incorrect password', 'getElementById', 'value', 'substring', 'picoCTF{', and 'not_this'. Below it is a self-invoking function that shuffles the array, followed by a _0x4b5b lookup function, and finally the verify() function with nested if-statements checking substring positions against array values. A red arrow at the bottom points to the pretty-print toggle button.](/writeups/picoctf-client-side-again/02.png)

The obfuscated code had three parts. First, an array `_0x5a46` containing all the strings used in the program — including fragments of the flag, UI messages like `'Password Verified'` and `'Incorrect password'`, and DOM method names like `'getElementById'` and `'substring'`. Second, a self-invoking function that shuffled the array positions by repeatedly popping elements from the end and pushing them to the front, making the original indices unreliable without running the shuffle. Third, a lookup function `_0x4b5b` that took a hex index, subtracted an offset, and returned the string at the resulting position in the shuffled array.

---

## Deobfuscating the verify function

The `verify()` function was a cascade of nested `if` statements, each checking a `substring` of the input against a value pulled from the array via the lookup function. To decode it, I used an online JavaScript editor ([PlayCode](https://playcode.io/javascript)) to run the array shuffle and print what each lookup call actually resolved to.

The array after shuffling contained these values at positions 0 through 9:

```
_0x5a46[0] = 'f49bf}'
_0x5a46[1] = '_again_e'
_0x5a46[2] = 'this'
_0x5a46[3] = 'Password Verified'
_0x5a46[4] = 'Incorrect password'
_0x5a46[5] = 'getElementById'
_0x5a46[6] = 'value'
_0x5a46[7] = 'substring'
_0x5a46[8] = 'picoCTF{'
_0x5a46[9] = 'not_this'
```

With the actual string values resolved, the `verify` function became straightforward to read. Each nested `if` checked a specific portion of the input string using `substring(start, end)` against a known fragment:

```javascript
function verify() {
    checkpass = document['getElementById']('pass')['value'];
    split = 0x4;
    if (checkpass['substring'](0, 8) == 'picoCTF{') {
        if (checkpass['substring'](7, 9) == '{n') {
            if (checkpass['substring'](8, 16) == 'not_this') {
                if (checkpass['substring'](3, 6) == 'oCT') {
                    if (checkpass['substring'](24, 32) == 'f49bf}') {
                        if (checkpass['substring'](6, 12) == 'F{not_') {
                            if (checkpass['substring'](16, 24) == '_again_e') {
                                if (checkpass['substring'](13, 20) == 'this') {
                                    alert('Password Verified');
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        alert('Incorrect password');
    }
}
```

Reading the substring checks in order and assembling the overlapping fragments: positions 0-8 gave `picoCTF{`, 8-16 gave `not_this`, 16-24 gave `_again_e`, and 24-32 gave `f49bf}`. Concatenated together: `picoCTF{not_this_again_ef49bf}`.

Entered the reconstructed flag into the password field and clicked verify. The page popped an alert confirming "Password Verified".

![The login page showing a browser alert dialog from jupiter.challenges.picoctf.org saying "Password Verified" with a pink OK button. The password field behind the dialog contains the entered flag in masked dots.](/writeups/picoctf-client-side-again/03.png)

`picoCTF{not_this_again_ef49bf}`

---

## What I took from this

Client-side validation is not security — it is user experience. Any code that runs in the browser is fully accessible to the user: they can read it, modify it, and bypass it entirely. Obfuscation adds friction but not protection. The shuffled array and hex-indexed lookups in this challenge made the code harder to read at a glance, but a few minutes with a JavaScript console resolved every reference. Tools like browser DevTools, online editors, and even `console.log` are enough to undo most JavaScript obfuscation. The takeaway for real applications is clear: never store secrets, passwords, API keys, or validation logic in client-side code. If the browser needs to verify something sensitive, it should send the input to the server and let the server decide. The client's job is to provide a user interface, not to enforce security.
