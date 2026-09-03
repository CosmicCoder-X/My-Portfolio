---
title: 'Some Assembly Required 3'
target: 'picoCTF — Some Assembly Required 3'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where a flag checker page loaded a WASM binary disguised with an .html extension, and decompiling it revealed a copy function that XORed input against a rotating 5-byte key to encode the flag.'
role: 'appsec'
tags: ['web-exploitation', 'webassembly', 'wasm', 'xor', 'reverse-engineering', 'wabt', 'picoctf']
problem: 'A flag checker web page that loads a JavaScript file referencing a WebAssembly binary. The binary contains the encoded flag and the encoding logic, both of which need to be reversed to recover the flag.'
action: 'Inspected the page source to find the JS file, identified the referenced file as a WASM binary, decompiled it with wasm-decompile from wabt, analysed the copy function to understand the rotating XOR key logic, and wrote a Python script to decode the flag.'
outcome: 'Retrieved the flag by reversing the XOR encoding that used a 5-byte key cycling in reverse over the encoded data segment.'
draft: false
---

## Background

Some Assembly Required 3 is a picoCTF Web Exploitation challenge and a step up from its predecessor in the series. Where Some Assembly Required 2 used a simple single-byte XOR, this challenge introduces a multi-byte rotating key — the encoded flag is XORed against a 5-byte key that cycles through its bytes in reverse order for each character position. The binary is also delivered with a misleading `.html` file extension, adding a layer of misdirection before the reverse engineering even begins.

---

## Inspecting the page source

The challenge page was a familiar flag checker — a text input, a Submit button, and a result paragraph. Viewing the page source revealed a minimal HTML document with a single script tag in the head loading `rTEuOmSfG3.js`.

![HTML source code of the challenge page showing an html document with a head containing meta charset UTF-8 and a script tag loading rTEuOmSfG3.js, and a body with an h4 reading "Enter flag:", a text input with id "input", a button with onclick "onButtonPress()" labelled Submit, and a paragraph with id "result".](/writeups/picoctf-some-assembly-required-3/01.png)

The JavaScript file followed the same pattern as earlier challenges in the series — obfuscated code that ultimately fetched a WebAssembly binary and wired its exported functions to the page's Submit button. The interesting part was the file it fetched: `qCCYI0ajpD.html`. The `.html` extension was a red herring.

---

## Identifying the WASM binary

Downloaded `qCCYI0ajpD.html` to the Kali machine and ran `file` on it. Despite the extension, the file was identified as a WebAssembly binary module — version 0x1, MVP format.

![Kali terminal showing the command "file qCCYI0ajpD.html" with the output "qCCYI0ajpD.html: WebAssembly (wasm) binary module version 0x1 (MVP)".](/writeups/picoctf-some-assembly-required-3/02.png)

The file extension meant nothing — the binary format signature told the whole story. The next step was to decompile it into something readable.

---

## Decompiling with wasm-decompile

Used `wasm-decompile` from the [wabt](https://github.com/WebAssembly/wabt) toolkit to convert the binary into a high-level, C-like pseudo-code representation. Unlike `wasm2wat` which produces raw instruction-level text, `wasm-decompile` generates output that reads much closer to source code — making the logic easier to follow.

![Kali terminal showing the command "wasm-decompile qCCYI0ajpD.html".](/writeups/picoctf-some-assembly-required-3/03.png)

The decompiled output revealed three exported functions — `strcmp`, `check_flag`, and `copy` — along with two data segments that held the encoded flag and the XOR key.

The data segments were the foundation of the whole challenge:

```
data d_1024(offset: 1024) =
  "\x9dn\x93\xc8\xb2\xb9A\x8b\xc2\x90\x8bd\xc7\x9e\xc9\x88b\x95\x91\x90\xda"
  "c\xc5\x95\x95\xd82\xc4\xc5\x92\x8ee\x92\x96\x97\x8ca\xc4\x93\x92\x90\x00\x00"

data d_1067(offset: 1067) = "\xf1\xa7\xf0\x07\xed"
```

`d_1024` was the encoded flag — 38 bytes of seemingly random data at memory offset 1024. `d_1067` was a 5-byte key at offset 1067. The `check_flag` function simply called `strcmp` to compare the decoded input (stored at offset 1072) against the encoded flag (at offset 1024), returning whether they matched.

---

## Understanding the copy function

The `copy` function was where the encoding happened. It took two arguments — the character value `a` and its position index `b` — and applied a XOR transformation before storing the result. The critical logic extracted from the decompiled output:

```
var j:int = h % i;         // h is the position index, i is 5
var k:ubyte_ptr = g - j;   // g is 4, so k = 4 - (position % 5)
var l:int = k[1067];       // read byte from d_1067 at that offset
var n:int = l << m;         // shift left 24 bits
var o:int = n >> m;         // shift right 24 bits (sign extension)
var q:int = p ^ o;         // XOR the input character with the key byte
```

The function cycled through the 5-byte key in reverse order. For position 0, it used key index 4. For position 1, key index 3. For position 2, key index 2. And so on, wrapping around every 5 characters. The left-shift-then-right-shift by 24 bits was a standard trick to sign-extend a byte value to a full 32-bit integer before the XOR.

This was a polyalphabetic XOR cipher — each character position used a different key byte, making it slightly more resistant to frequency analysis than the single-byte XOR in Some Assembly Required 2, but still completely reversible once the key was known. And the key was sitting right there in the binary's data section.

---

## Writing the decode script

Translated the `copy` function's logic into Python. The script iterated over each byte in `d_1024`, calculated the corresponding key byte index using the same reverse-cycling formula, XORed the two values, and printed the decoded character:

```python
d_1024 = "\x9dn\x93\xc8\xb2\xb9A\x8b\xc2\x90\x8bd\xc7\x9e\xc9\x88b\x95\x91\x90\xdac\xc5\x95\x95\xd82\xc4\xc5\x92\x8ee\x92\x96\x97\x8ca\xc4\x93\x92\x90\x00\x00"
d_1067 = "\xf1\xa7\xf0\x07\xed"

for i in range(len(d_1024)):
    char_1024 = d_1024[i]
    index_1067 = 4 - (i % 5)
    char_1067 = d_1067[index_1067]
    decoded_char = chr(ord(char_1024) ^ ord(char_1067))
    print(decoded_char, end="")
```

Ran it with `python3 solve.py` and the flag printed to the terminal.

---

## What I took from this

This challenge builds directly on Some Assembly Required 2 by upgrading the encoding from a single-byte XOR to a rotating multi-byte key — a polyalphabetic cipher. The `.html` file extension on the WASM binary was a small but effective misdirection; `file` command identification by magic bytes rather than extension is a fundamental habit in binary analysis. The `wasm-decompile` tool from wabt proved more useful here than raw `wasm2wat` disassembly — producing pseudo-code that made the key cycling logic immediately readable without mentally tracing stack operations. The core lesson remains the same as the previous challenge: any encoding scheme where the key is shipped alongside the ciphertext in client-side code is security by obscurity. XOR with a known key, whether single-byte or multi-byte, is trivially reversible. The real takeaway is the progression — from single-byte XOR to rotating keys to potentially more complex schemes — and the methodology: identify the data segments, understand the transformation function, and reverse it. The tools and the approach stay the same regardless of the complexity.
