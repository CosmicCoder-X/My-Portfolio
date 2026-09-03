---
title: 'Tapping'
target: 'picoCTF — Tapping'
difficulty: 'easy'
date: 2026-07-22
summary: "A picoCTF Cryptography challenge where a netcat service returned the flag encoded in Morse code, and writing a Python script with pwntools to connect, receive, and decode the Morse automatically extracted the flag."
role: 'appsec'
tags: ['cryptography', 'morse-code', 'python', 'pwntools', 'picoctf']
problem: "A netcat service that outputs a string of dots and dashes — the flag encoded in Morse code. The challenge description says there is tapping coming in from the wires, and the hint confirms the encoding uses dashes and dots."
action: "Connected to the service with netcat to retrieve the Morse-encoded message, recognised the dot-dash pattern as Morse code from the first few decoded characters matching the flag prefix, then wrote a Python script using pwntools that connected to the server, received the message, and decoded each Morse sequence through a lookup dictionary."
outcome: 'Decoded the Morse code message to retrieve the flag.'
draft: false
---

## Background

Tapping is a picoCTF Cryptography challenge about Morse code — one of the oldest forms of electronic communication encoding. The challenge description says "There's tapping coming in from the wires. What's it saying?" and provides a netcat endpoint. The hints confirm that the encoding uses dashes and dots, and that the flag format is `PICOCTF{}`. Morse code was developed in the 1830s by Samuel Morse and Alfred Vail for use with the electric telegraph, encoding each letter and digit as a unique sequence of short signals (dots) and long signals (dashes) separated by pauses.

---

## Retrieving the encoded message

Connected to the service with netcat:

```
$ nc jupiter.challenges.picoctf.org 9422
```

The server returned a single line of dots, dashes, and spaces:

```
.--. .. -.-. --- -.-. - ..-. { -- ----- .-. ... ...-- -.-. ----- -.. ...-- .---- ... ..-. ..- -. ..--- -.... ---.. ...-- ---.. ..--- ....- -.... .---- ----- }
```

The format was unmistakable — each letter was represented as a sequence of dots and dashes separated by spaces, with curly braces preserved as literal characters. Manually decoding the first few sequences confirmed the pattern: `.--. = P`, `.. = I`, `-.-. = C`, `--- = O` — the start of `PICO`, matching the expected flag prefix.

---

## Writing the decoder script

Rather than decoding the entire message by hand, wrote a Python script using `pwntools` to automate both the retrieval and the decoding:

```python
from pwn import *

MORSE_CODE_ALPHABET = {
    ".-": "A", "-...": "B", "-.-.": "C", "-..": "D", ".": "E", "..-.": "F",
    "--.": "G", "....": "H", "..": "I", ".---": "J", "-.-": "K", ".-..": "L",
    "--": "M", "-.": "N", "---": "O", ".--.": "P", "--.-": "Q", ".-.": "R",
    "...": "S", "-": "T", "..-": "U", "...-": "V", ".--": "W", "-..-": "X",
    "-.--": "Y", "--..": "Z", "-----": "0", ".----": "1", "..---": "2",
    "...--": "3", "....-": "4", ".....": "5", "-....": "6", "--...": "7",
    "---..": "8", "----.": "9"
}

def fetch_morse_code_message(host="jupiter.challenges.picoctf.org", port=9422):
    try:
        conn = remote(host, port)
        morse_code_message = conn.recvline().decode().strip()
        conn.close()
        return morse_code_message
    except Exception as e:
        print(f"Error connecting to server: {e}")
        return ""

def decode_morse_code(morse_code_message):
    message_chars = morse_code_message.split(" ")
    flag = ""
    for i in message_chars:
        if i in "{}":
            flag += i
        else:
            flag += MORSE_CODE_ALPHABET.get(i, "")
    return flag

def main():
    morse_code_message = fetch_morse_code_message()
    if not morse_code_message:
        print("Failed to retrieve Morse code message from the server.")
        return
    flag = decode_morse_code(morse_code_message)
    print(f"The flag is: {flag}")

if __name__ == "__main__":
    main()
```

The script worked in three stages. The `fetch_morse_code_message` function used pwntools' `remote()` to open a TCP connection to the challenge server, read a single line, and close the connection. The `decode_morse_code` function split the received string on spaces — since Morse code uses spaces to separate individual character encodings — and looked up each dot-dash sequence in the dictionary. Curly braces were passed through unchanged since they are not part of the Morse alphabet and were included as literal delimiters in the server's output. The `main` function tied the two together: connect, receive, decode, print.

Running the script:

```
$ python3 script.py
[+] Opening connection to jupiter.challenges.picoctf.org on port 9422: Done
[*] Closed connection to jupiter.challenges.picoctf.org port 9422
The flag is: PICOCTF{M0RS3C0D31SFUN2683824610}
```

`PICOCTF{M0RS3C0D31SFUN2683824610}`

---

## What I took from this

Morse code is not encryption — it is encoding. The distinction matters: encoding transforms data into a different format using a publicly known scheme (like base64, URL encoding, or Morse), while encryption transforms data using a secret key so that only someone with the key can reverse it. Anyone who recognises dots and dashes as Morse can decode the message without needing any secret. This challenge was a straightforward decoding exercise, but the scripting approach added value beyond just solving it. Using pwntools to connect to the server programmatically rather than copying and pasting from the terminal is the same workflow used in more complex CTF challenges where the server sends different data each time, imposes time limits, or requires multiple rounds of interaction. Building the habit of scripting even simple tasks — defining the alphabet as a dictionary, splitting on delimiters, looking up each token — creates reusable patterns that scale to harder problems like automated exploit chains and multi-stage protocol interactions.
