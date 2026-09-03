---
title: 'Transformation'
target: 'picoCTF — Transformation'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Reverse Engineering challenge where the flag was encoded by combining pairs of ASCII characters into single 16-bit Unicode characters using a left bit shift, and reversing it required extracting each original byte with a right shift and a bitmask.'
role: 'appsec'
tags: ['reverse-engineering', 'python', 'bit-manipulation', 'unicode', 'encoding', 'picoctf']
problem: 'An encoded string of Unicode characters and a Python one-liner showing how the flag was transformed — each pair of 8-bit ASCII characters was combined into a single 16-bit Unicode character using a left shift and addition.'
action: 'Analysed the encoding one-liner to understand the bit shift and addition, then wrote a reversal function that extracted each original character pair by right-shifting the combined value by 8 bits for the first character and masking with 0xFF for the second.'
outcome: 'Decoded the Unicode string back into the original ASCII flag.'
draft: false
---

## Background

Transformation is a picoCTF Reverse Engineering challenge about bit manipulation and character encoding. The challenge provides a string of unusual Unicode characters and a single line of Python that produced them. The task is to understand the encoding operation and reverse it to recover the original flag. No binary analysis or decompilation is needed — just an understanding of how bit shifting combines two 8-bit values into one 16-bit value, and how to take them apart again.

---

## The encoding operation

The challenge provided the encoded output and the Python expression that generated it:

```python
''.join([chr((ord(flag[i]) << 8) + ord(flag[i + 1])) for i in range(0, len(flag), 2)])
```

The encoded result was: `灩捯䍔䙻ㄶ形楴獟楮獴㌴摟潦弸弰摤捤㤷慽`

Breaking the expression down step by step: it iterated through the flag two characters at a time. For each pair, it took the Unicode code point of the first character with `ord()`, left-shifted it by 8 bits (equivalent to multiplying by 256), then added the code point of the second character. The result was a single integer that packed both characters into 16 bits — the first character occupied the upper 8 bits and the second character occupied the lower 8 bits. Finally, `chr()` converted this combined integer back into a single Unicode character.

Taking a concrete example with the characters `'A'` (code point 65) and `'B'` (code point 66): `(65 << 8) + 66 = 16640 + 66 = 16706`. In binary, 65 is `01000001` and 66 is `01000010`, so the combined value `16706` is `01000001 01000010` — the two original bytes sitting side by side in a 16-bit integer. The `chr()` of `16706` produces the Unicode character `䅂`, which is one of those unusual-looking characters in the encoded string.

---

## Reversing the operation

To recover the original pair of characters from each combined Unicode character, two operations were needed. A right shift by 8 bits (`>> 8`) extracted the first character by discarding the lower 8 bits and keeping the upper 8. A bitwise AND with `0xFF` (`& 0xFF`) extracted the second character by masking out the upper bits and keeping only the lower 8.

Using the same example: `16706 >> 8 = 65` (which is `'A'`), and `16706 & 0xFF = 66` (which is `'B'`). The AND with `0xFF` (binary `11111111`) works because it zeroes out every bit above position 7, isolating exactly the lower byte:

```
01000001 01000010  (16706)
00000000 11111111  (0xFF)
─────────────────
00000000 01000010  (66 → 'B')
```

The reversal script applied this to every character in the encoded string:

```python
def reverse_operation(combined_char):
    combined_value = ord(combined_char)
    first_char = chr(combined_value >> 8)
    second_char = chr(combined_value & 0xFF)
    return first_char, second_char

enc_flag = '灩捯䍔䙻ㄶ形楴獟楮獴㌴摟潦弸弰摤捤㤷慽'

flag = ''
for combined_char in enc_flag:
    first_char, second_char = reverse_operation(combined_char)
    flag = flag + first_char + second_char

print(flag)
```

Running this produced the flag.

`picoCTF{16_bits_inst34d_of_8_0ddcd97a}`

---

## What I took from this

Bit shifting is one of the most fundamental operations in computing, and this challenge is a clean illustration of how it works in practice. Left-shifting by 8 bits moves a value into the "upper byte" of a 16-bit integer, leaving room in the lower byte for a second value to be added. The reversal uses the complementary operations: right-shifting pulls the upper byte back down, and a bitmask isolates the lower byte. The same principle underpins everything from colour encoding (packing RGB values into a single integer) to network protocols (combining header fields into fixed-width words) to file format parsing. The `divmod()` function offers an arithmetic alternative to the bitwise approach — `divmod(combined_value, 256)` returns the quotient (first character) and remainder (second character) — but the bitwise operations are more explicit about what is happening at the binary level, and they are the standard idiom for this kind of byte packing and unpacking.
