---
title: 'St3g0'
target: 'picoCTF — St3g0'
difficulty: 'easy'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where the flag was hidden in the least significant bits of a PNG image's RGB pixel data, extracted with zsteg after binwalk and exiftool turned up nothing."
role: 'forensics'
tags: ['forensics', 'steganography', 'lsb', 'zsteg', 'png', 'picoctf']
problem: "A PNG image of the picoCTF logo with the instruction to download and find the flag hidden somewhere within it."
action: "Tried binwalk for embedded files and exiftool for metadata with no results, then ran zsteg with the -a flag to check all bit planes and colour channels, which revealed the flag embedded in the RGB LSB layer."
outcome: 'Extracted the flag from the rgb,lsb,xy channel of the PNG image.'
draft: false
---

## Background

St3g0 is a picoCTF Forensics challenge about image steganography. The challenge provides a PNG image of the picoCTF logo and simply asks to find the flag hidden within it. The name "St3g0" is leetspeak for "stego," pointing directly at steganography — the practice of concealing data within ordinary-looking media files by making imperceptible modifications to the underlying data.

---

## Initial analysis

Started with the standard forensic triage tools. Running `binwalk` on the image searched for embedded files, appended archives, or hidden filesystems within the PNG — none were found. Running `exiftool` examined the image's metadata headers for anything unusual — again, nothing of interest. The flag was not hidden in an appended file or a metadata field, which meant it was likely embedded at the pixel level.

---

## LSB analysis with zsteg

Turned to `zsteg`, a tool purpose-built for detecting steganographic data in PNG and BMP files. It works by extracting data from specific bit planes across different colour channels and byte orderings, then running heuristics to identify whether the extracted data looks like readable text, known file signatures, or other structured content. The `-a` flag tells it to check all combinations:

```
zsteg -a pico.flag.png
```

![Kali terminal showing zsteg -a output on pico.flag.png. The first few lines show various bit plane extractions. The b1,rgb,lsb,xy line is highlighted in red and reads "picoCTF{7h3r3_15_n0_5p00n_a9a181eb}$t3g0". Other lines show noise — random text fragments, file type misidentifications like Targa image data, Hitachi SH COFF object files, Applesoft BASIC program data, tar archives, PDP-11 executables, and Commodore C64 BASIC programs.](/writeups/picoctf-st3g0/01.png)

The output was dense — `zsteg` tries every bit plane and channel combination, and most of them produce garbage that it attempts to identify as known file formats. But the second line stood out immediately. The `b1,rgb,lsb,xy` extraction — meaning bit 1 of the RGB channels, read in LSB (least significant bit) order, scanned in x-then-y (left-to-right, top-to-bottom) order — produced readable text highlighted in red:

`picoCTF{7h3r3_15_n0_5p00n_a9a181eb}$t3g0`

The flag was `picoCTF{7h3r3_15_n0_5p00n_a9a181eb}`, followed by the trailing string `$t3g0` which was part of the embedded data but not part of the flag itself.

---

## What I took from this

This challenge demonstrated the most common form of image steganography: LSB embedding. The technique works by replacing the least significant bit of each colour channel byte with one bit of the hidden message. Since the LSB contributes the smallest possible change to a pixel's colour value (a difference of 1 out of 256 in each channel), the modification is imperceptible to the human eye — the image looks identical before and after embedding. The channel notation `b1,rgb,lsb,xy` describes exactly where the data was: bit plane 1 (the least significant), across the red, green, and blue channels, with bytes read in least-significant-bit-first order, scanning pixels left-to-right then top-to-bottom. The reason `binwalk` and `exiftool` failed to find anything is that LSB steganography does not alter the file's structure, headers, or metadata — it only modifies pixel values, which are perfectly valid image data. Detection requires either statistical analysis (tools like `stegdetect` look for anomalies in bit plane distributions) or brute-force extraction across all possible channel and bit plane combinations, which is exactly what `zsteg -a` does. In CTF forensics, the standard triage order for image challenges is: `file` and `exiftool` for metadata, `binwalk` for embedded files, `strings` for plaintext, and then `zsteg` (for PNG/BMP) or `steghide` (for JPEG) for pixel-level steganography.
