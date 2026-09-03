---
title: 'Some Assembly Required 2'
target: 'picoCTF — Some Assembly Required 2'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where deobfuscating the page JavaScript revealed a WASM binary path, and disassembling the binary exposed a XOR-with-8 encoding on the flag string stored in the data section.'
role: 'appsec'
tags: ['web-exploitation', 'webassembly', 'wasm', 'xor', 'javascript-deobfuscation', 'reverse-engineering', 'picoctf']
problem: 'A flag checker web page at mercury.picoctf.net:53929. Entering a string and clicking Submit tells you if it is correct, but the validation logic is buried in obfuscated JavaScript and a WebAssembly binary.'
action: 'Intercepted the JavaScript in Burp Suite, beautified and deobfuscated it to find a WASM binary path, disassembled the binary with wasm2wat, identified a XOR-with-8 operation and an encoded string in the data section, then wrote a Python script to decode it.'
outcome: 'Retrieved the flag by XOR-decoding the embedded string from the WASM data section.'
draft: false
---

## Background

Some Assembly Required 2 is a picoCTF Web Exploitation challenge that sits at the intersection of web analysis and reverse engineering. The challenge serves a flag checker — a page where you type a string and it tells you if it is the flag. The actual validation runs in WebAssembly (WASM), a binary instruction format that browsers can execute alongside JavaScript. The JavaScript that loads the WASM is obfuscated, adding an extra layer before you even reach the binary. The goal is to trace the validation logic from the page source all the way down to the encoded flag string.

---

## Intercepting the JavaScript

The challenge page at `mercury.picoctf.net:53929` was a simple flag checker — a text input labelled "Enter flag:" with a Submit button. No visible source code, no hints on the page itself. Opened Burp Suite and intercepted the traffic to see what the browser was loading behind the scenes.

The page pulled in a JavaScript file at `/Y8splx37qY.js`. The response was 1,681 bytes of obfuscated code — a `const` array of shuffled strings (`copy_char`, `value`, `207aLjBod`, `check_flag`, `Correct!`, etc.) followed by functions that indexed into that array using hex offsets with arithmetic to reconstruct the actual logic.

![Burp Suite showing the GET request for /Y8splx37qY.js on the left with request headers including Host: mercury.picoctf.net:53929, and the 200 OK response on the right showing Content-Type: application/javascript with obfuscated code containing a const array of shuffled strings and hex-offset indexing functions.](/writeups/picoctf-some-assembly-required-2/01.png)

The obfuscation pattern was a common one: store all meaningful strings in an array, then reference them by computed index throughout the code so that reading it linearly makes no sense. The function `_0x5c00` took an index, subtracted `0xc3` from it, and returned the string at that position in the array — a simple lookup table with an offset.

---

## Deobfuscating and finding the WASM path

Copied the JavaScript into a beautifier to get it into a readable format. With the array laid out on a single line and the indexing function visible, the string references became clear. One entry stood out immediately: `./aD8SvhyVkb` — a relative path that did not look like a standard web resource.

![Beautified JavaScript showing the const array on one line with all strings visible. The entry './aD8SvhyVkb' is highlighted in blue/orange, standing out among the other strings like 'copy_char', 'check_flag', 'Correct!', 'innerHTML', 'charCodeAt', 'exports', and 'getElementById'.](/writeups/picoctf-some-assembly-required-2/02.png)

The surrounding code used `WebAssembly.instantiate` to load a binary from that path, then called the exported `copy_char` and `check_flag` functions to validate user input. The JavaScript was just a wrapper — the real logic lived in the WASM binary at `/aD8SvhyVkb`.

---

## Downloading the WASM binary

Navigated directly to `mercury.picoctf.net:53929/aD8SvhyVkb` in the browser. The server served the file as a download — 864 bytes, a compact WebAssembly binary.

![Browser at mercury.picoctf.net:53929/aD8SvhyVkb showing the download history panel with file aD8SvhyVkb at 864 bytes.](/writeups/picoctf-some-assembly-required-2/03.png)

864 bytes is tiny for a binary, which meant the logic inside would be straightforward — likely a single function doing a character-by-character comparison with some transformation applied.

---

## Disassembling the WASM

Converted the binary to WAT (WebAssembly Text Format) using `wasm2wat` to read the actual instructions. The disassembly revealed the critical operation inside the `copy_char` function: an `i32.xor` instruction with a constant value of `8`.

![WAT disassembly showing a local.set instruction followed by i32.const 8, then local.set $l8 with an i32.xor operation — XORing each character with the value 8.](/writeups/picoctf-some-assembly-required-2/04.png)

This was the encoding: every character of the flag was XORed with `8` before being compared. If the XOR of the input character matched the stored value, the character was correct. To recover the flag, the same XOR operation needed to be applied in reverse — and since XOR is its own inverse, XORing the stored values with `8` would produce the original flag.

The next piece was finding what the stored values actually were. Scrolling down to the data section of the WAT file revealed the memory layout: a `data` segment at offset 1024 containing the encoded flag string.

![WAT disassembly showing the memory section with exports for 'input' at offset 1072 and '__dso_handle' at offset 1024, followed by the data section: (data $d0 (i32.const 1024) "xakgK\5cNs>n;jl90;9:mjn9m<0n9::0::881<00?>u\00\00").](/writeups/picoctf-some-assembly-required-2/05.png)

The encoded string at offset 1024 was `xakgK\5cNs>n;jl90;9:mjn9m<0n9::0::881<00?>u` — a sequence of bytes that, when XORed with `8`, would decode to the flag.

---

## Decoding the flag

Wrote a short Python script to XOR each byte of the encoded string with `8`:

```python
encoded = "xakgK\\5cNs>n;jl90;9:mjn9m<0n9::0::881<00?>u"
decoded = ''.join(chr(ord(c) ^ 8) for c in encoded)
print(decoded)
```

Ran the script and got the flag.

![Kali terminal showing the command python3 wasm_decode.py and the output: picoCT=kF{6f3bd18312ebf1e48f12282200948876}.](/writeups/picoctf-some-assembly-required-2/06.png)

Pasted the decoded flag into the checker on the challenge page and got the confirmation.

![The flag checker page showing "Enter flag:" with picoCTF{6f3bd18312ebf1e48f in the input field, a Submit button, and "Correct!" displayed below.](/writeups/picoctf-some-assembly-required-2/07.png)

`picoCTF{6f3bd18312ebf1e48f12282200948876}`

---

## What I took from this

This challenge chains together three skills that come up constantly in web application assessments: JavaScript deobfuscation, binary analysis, and understanding encoding versus encryption. The obfuscated JavaScript used a shuffled string array with computed indices — a pattern generated by tools like javascript-obfuscator that is tedious to read but trivial to reverse once you identify the lookup function. The real security-relevant takeaway is in the WASM: XOR with a single-byte key is not encryption, it is obfuscation. A fixed key means every encoded value can be decoded by anyone who reads the binary, and WASM binaries are delivered to the client just like JavaScript — the user has full access to them. The `wasm2wat` tool converts the binary format to a human-readable text format, making the instructions, memory layout, and embedded data fully transparent. Any secret embedded in client-side code — whether in JavaScript, WASM, or a compiled binary — is not secret. Server-side validation is the only way to protect sensitive logic from inspection.
