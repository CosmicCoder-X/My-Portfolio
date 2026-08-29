---
title: 'BitsNBytes'
target: 'Hack The Box — BitsNBytes'
difficulty: 'easy'
date: 2025-08-29
summary: 'A steganography challenge — given two visually identical PNG images (intercepted.png and original.png), using StegSolve image combiner in SUB mode to reveal hidden pixel differences along the leftmost column, writing a Python script with PIL to extract the first vertical line and map black pixels to 0 and white pixels to 1, converting the resulting binary string to ASCII to get a base64-encoded string, and decoding it to recover the flag.'
role: 'forensics'
tags: ['steganography', 'image-analysis', 'stegsolve', 'python', 'pil', 'binary', 'base64', 'pixel-manipulation', 'image-subtraction']
problem: 'Two PNG images are provided — intercepted.png and original.png. Both are 775x550 pixels and visually identical, with file sizes differing by only 0.1 kB. The flag is hidden somewhere in the difference between the two images.'
action: 'Opened both images side by side and confirmed they look identical. Used StegSolve image combiner with the SUB (subtraction) operation to subtract original.png from intercepted.png, revealing small white dots along the leftmost vertical column of the resulting image. Wrote a Python script using PIL to iterate over the first column (x=0) of the intercepted image, mapping each pixel to 0 for black (0, 0, 0) and 1 for white (255, 255, 255). Ran the script to extract a binary string, converted it to ASCII text which produced a base64-encoded string, and decoded it to get the flag.'
outcome: 'Recovered the flag HTB{1f_a_w00d_chuck_c0uld_chuck_w00d} by decoding the base64 string SFRCezFmX2FfdzAwZF9jaHVja19jMHVsZF9jaHVja193MDBkfQ== extracted from pixel data hidden in the first column of the intercepted image.'
draft: false
---

## Background

BitsNBytes is an image steganography challenge that hides data in the most literal way possible — individual pixels modified to encode binary. The challenge provides two images that look identical to the human eye, and the flag is encoded as a single column of black and white pixels along the left edge of one of them. The solve is a clean pipeline: spot the difference, extract the bits, decode the message.

---

## Two identical images

The challenge provides two files — `intercepted.png` and `original.png`. Both are 775x550 pixels, and the file sizes are nearly identical (970.8 kB vs 970.7 kB — a difference of 0.1 kB). Opening them side by side shows the same image: Chuck Norris in a denim vest holding two guns. There's no visible difference.

![File browser showing intercepted.png and original.png side by side, both open in image viewers displaying the same 775x550 pixel photo of Chuck Norris, with file sizes of 970.8 kB and 970.7 kB respectively.](/writeups/htb-bitsnbytes/01-images-side-by-side.png)

The file size difference of 0.1 kB tells us something has been modified, but only slightly. A single column of pixels being flipped from black to white (or vice versa) would account for that kind of minimal change.

---

## StegSolve — finding the difference

Since the images look identical, the difference has to be at the pixel level. StegSolve's image combiner handles this — it takes two images and applies mathematical operations between them pixel by pixel. Loading `intercepted.png` and subtracting `original.png` using the **SUB** operation produces a mostly black image with a few small white dots visible along the very left edge.

Those dots are the modified pixels. Each one sits on the first column (x=0) of the image, running vertically down the left side. The rest of the subtracted image is pure black — meaning every other pixel is identical between the two files. The data is encoded entirely in that single vertical column.

---

## Extracting the binary

Knowing the data is in the first column, a short Python script using PIL extracts it. The script opens the intercepted image, iterates over every pixel in column x=0 from top to bottom, and maps each pixel value to a binary digit — black `(0, 0, 0)` becomes `0`, white `(255, 255, 255)` becomes `1`.

![Python script code.py in a code editor showing PIL Image import, opening the image passed as sys.argv[1], getting width and height from im.size, loading pixels with im.load, iterating over x in range(0, 1) and y in range(0, height-1), reading each pixel as bin=pix[x, y], and building a binary string by replacing (0, 0, 0) with 0 and (255, 255, 255) with 1.](/writeups/htb-bitsnbytes/02-python-script.png)

```python
from PIL import Image
import sys
img = sys.argv[1]
im = Image.open(img, 'r')
width, height = im.size
pix = im.load()
binary = ""
for x in range(0, 1):
    for y in range(0, height- 1):
        bin=pix[x, y]
        binary += str(bin).replace("(0, 0, 0)","0").replace("(255, 255, 255)","1")

print binary
```

Running `python code.py out.png` on the subtracted image produces a binary string — a long sequence of 0s and 1s, with the tail end trailing into all zeros (the remaining pixels below the encoded data).

![Terminal output from running python code.py out.png showing a long binary string of 0s and 1s, with the last portion being all zeros.](/writeups/htb-bitsnbytes/03-binary-output.png)

---

## Binary to base64 to flag

Converting the binary string to ASCII text (splitting into 8-bit chunks and converting each to its character) produces a base64-encoded string:

```
SFRCezFmX2FfdzAwZF9jaHVja19jMHVsZF9jaHVja193MDBkfQ==
```

Decoding the base64 reveals the flag:

```
HTB{1f_a_w00d_chuck_c0uld_chuck_w00d}
```

The Chuck Norris image wasn't just a random choice — the flag is a play on the tongue twister "if a woodchuck could chuck wood", fitting the theme.

---

## What I took from this

The challenge demonstrates the simplest form of image steganography — modifying specific pixels to encode data directly. The approach is crude compared to LSB (Least Significant Bit) steganography, which hides data by altering only the least significant bit of each pixel's colour channels, making the change genuinely invisible even at the binary level. Here the pixels are flipped entirely between black and white, which is why the file size changes and why image subtraction reveals them immediately.

StegSolve's SUB operation is the go-to first step for any challenge that provides two versions of the same image. Subtracting one from the other cancels out everything that's identical and leaves only what changed — it's the image equivalent of a diff. Other useful StegSolve modes include XOR (which does the same thing but with bitwise XOR instead of subtraction) and the individual bit plane views (which isolate each bit of each colour channel to reveal LSB-encoded data). For two-image comparison challenges, SUB or XOR is almost always the right starting point.

The encoding chain — pixel values to binary to ASCII to base64 to plaintext — is a common layering pattern in CTF steganography. Each layer is trivial to reverse on its own, but the challenge is recognising that the layers exist and applying them in the right order. The trailing zeros in the binary output are a helpful signal: they mark where the actual data ends and the remaining black pixels begin, confirming that the encoding runs top-to-bottom down the column and stops partway through the image height.
