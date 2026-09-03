---
title: 'Surfing the Waves'
target: 'picoCTF — Surfing the Waves'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Forensics challenge where a WAV audio file with an unusual 2736 Hz sample rate contained hexadecimal values encoded in its raw sample data, and mapping each sample through integer division and a hex lookup table decoded the hidden flag.'
role: 'forensics'
tags: ['forensics', 'steganography', 'audio', 'wav', 'python', 'picoctf']
problem: 'An audio file retrieved from an FBI server. The WAV file has an unusual sample rate and sounds like noise when played — the flag is hidden in the raw sample values rather than the audible content.'
action: "Verified the file type with exiftool, noted the non-standard 2736 Hz sample rate, read the raw samples with scipy, discovered that the unique values fell into 16 groups spaced 500 apart (indicating hexadecimal encoding), then divided each sample by 500 and subtracted 2 to map values to hex digits 0-15."
outcome: 'Decoded the hex-encoded sample data to ASCII text containing the flag.'
draft: false
---

## Background

Surfing the Waves is a picoCTF Forensics challenge about audio steganography — hiding data inside a WAV file's raw sample values rather than in its metadata or audible content. The challenge provides a single file called `main.wav` described as audio "retrieved from an FBI server." The title hints that the solution involves the audio waveform itself, not what it sounds like when played.

---

## Initial analysis

Started with standard file analysis tools to understand what the file was and whether any obvious clues were embedded in it:

```
$ file main.wav
main.wav: RIFF (little-endian) data, WAVE audio, Microsoft PCM, 16 bit, mono 2736 Hz

$ exiftool main.wav
File Name               : main.wav
File Size               : 5.5 kB
Encoding                : Microsoft PCM
Num Channels            : 1
Sample Rate             : 2736
Bits Per Sample         : 16
Duration                : 1.00 s
```

The file was a valid WAV — mono, 16-bit PCM, one second long. Nothing unusual in the metadata, and `strings` combined with `grep` found no embedded flag text. Playing the audio produced unintelligible noise, which was expected for a file this short with data-encoded samples.

The sample rate stood out immediately: 2736 Hz is not a standard audio sample rate. Normal rates are 8000, 22050, 44100, 48000, or 96000 Hz. A non-standard rate like 2736 suggested the file was constructed for data encoding purposes rather than audio playback.

---

## Discovering the pattern

Used `scipy.io.wavfile` to read the raw sample data and examine the actual values:

```python
import scipy.io.wavfile as s

file = s.read("main.wav")
data = file[1]
no_dupe = set(data)
```

The `set()` of unique values revealed a striking pattern. The samples were not continuous waveform values — they fell into discrete groups, each group spanning a range of 10 values with the starting points spaced exactly 500 apart:

```
1000 -> 1009
1500 -> 1509
2000 -> 2009
...
7500 -> 7509
8000 -> 8009
8500 -> 8509
```

There were exactly 16 of these groups. Sixteen distinct symbols is the hallmark of hexadecimal encoding — hex uses digits 0 through 9 and letters a through f, totalling 16 possible values per position.

---

## Decoding the samples

The mapping from sample values to hex digits required two arithmetic operations. Dividing each sample by 500 collapsed the groups into sequential integers, but the lowest group (starting at 1000) mapped to 2 instead of 0. Subtracting 2 after the division shifted the range to 0-15, which mapped directly to hex digits:

```python
import string

hexx = [x.item() // 500 - 2 for x in data]
```

Each integer in the resulting array was an index into `string.hexdigits` (which contains `0123456789abcdef`). Converting each index to its corresponding hex character, joining them into a single string, and decoding the hex string as bytes produced readable ASCII text:

```python
hex_str = [string.hexdigits[x] for x in hexx]
hex_str = "".join(hex_str)
result = bytearray.fromhex(hex_str).decode()
print(result)
```

The output was a block of text with the flag embedded at the end.

`picoCTF{mU21C_1s_1337_b58b4519}`

---

## What I took from this

This challenge demonstrated a form of steganography where the hidden data is not in the audible content, the metadata, or appended bytes — it is the sample data itself, structured as an encoding scheme rather than a waveform. Standard forensic tools like `strings`, `exiftool`, and hex editors would not reveal this because the data looks like normal (if unusual) PCM samples. The non-standard sample rate was the first clue that the file was synthetic rather than a recording, and the discrete clustering of sample values into exactly 16 groups confirmed the hexadecimal encoding. The broader lesson is that audio files (and image files, and any binary format) have a raw data layer beneath their intended interpretation, and that layer can carry arbitrary information. Detecting this kind of steganography requires examining the statistical distribution of sample values — a natural audio signal has a roughly Gaussian distribution, while an encoded signal like this one has sharp spikes at specific values. Tools like `scipy` and `numpy` make this kind of analysis straightforward in Python.
