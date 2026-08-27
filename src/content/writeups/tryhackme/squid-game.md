---
title: 'Squid Game'
target: 'TryHackMe — Squid Game'
difficulty: 'hard'
date: 2026-08-27
summary: 'A malicious document analysis challenge covering five attacker samples — each embedding a different obfuscation and delivery technique — dissected with OLEtools, ViperMonkey, CyberChef, and scdbgc to extract C2 infrastructure, dropped payloads, and a Cobalt Strike beacon.'
role: 'forensics'
tags: ['OLEtools', 'oledump', 'olevba', 'ViperMonkey', 'CyberChef', 'scdbgc', 'Malicious documents', 'VBA macros', 'PowerShell', 'Cobalt Strike', 'Shellcode', 'XOR']
problem: 'Five malicious Word documents from five different attackers, each using a distinct obfuscation and payload delivery chain — from ChrW-encoded PowerShell and reversed command strings to XOR-encrypted COM object names and Cobalt Strike shellcode. The goal is to fully analyze each document, extract every indicator of compromise, and map the complete attack chain from macro execution to C2 communication.'
action: 'Analyzed each document using a layered toolchain: oledump.py for stream enumeration and macro identification, olevba for VBA extraction and static analysis, olemeta and oletimes for metadata forensics, ViperMonkey for dynamic macro emulation, CyberChef for multi-stage deobfuscation (Base64 decoding, character substitution, hex conversion, XOR decryption), and scdbgc for shellcode emulation to reveal network indicators.'
outcome: 'All five attacker documents fully analyzed with every question answered — C2 domains, dropped executables, COM object abuse, DLL sideloading chains, and a Cobalt Strike beacon''s full network signature (IP, port, URI path, User-Agent) extracted and documented.'
draft: false
---

Squid Game is a TryHackMe room themed after the show, but the actual
content is pure malicious document analysis. Five attacker samples, each
using a different obfuscation technique, each requiring a different
combination of tools to crack open. The room covers the full spectrum of
maldoc analysis: OLE stream enumeration, VBA macro extraction, PowerShell
deobfuscation, XOR decryption, dynamic emulation with ViperMonkey, and
shellcode analysis with scdbgc. It's one of the more comprehensive
forensics rooms on the platform.

## Toolchain

The analysis uses a consistent set of tools across all five samples:

- **oledump.py** — enumerates OLE streams and identifies which ones
  contain macros (marked with `M`)
- **olevba** — extracts VBA macro source code and flags suspicious
  patterns (AutoOpen/AutoExec, Shell calls, obfuscated strings)
- **olemeta** / **oletimes** — pulls document metadata (author, subject,
  phone number, timestamps)
- **ViperMonkey (vmonkey)** — dynamically emulates VBA macros without
  executing them, recording every action the macro would take
- **CyberChef** — multi-stage deobfuscation: Base64 decoding, character
  substitution, hex decoding, XOR decryption, null byte removal
- **scdbgc** — emulates shellcode and logs API calls, revealing network
  indicators without running the payload

## Attacker 1 — Obfuscated PowerShell via ChrW encoding

### Stream analysis

Starting with oledump.py to enumerate the OLE streams in `attacker1.doc`:

```bash
oledump.py attacker1.doc
```

![oledump.py output showing attacker1.doc OLE streams with 13 entries including Macros and MsoDataStore](/writeups/thm-squid-game/01-oledump-attacker1-streams.png)

The output lists 13 streams. Stream 8 is marked with `M` — it contains
VBA macro code in `Macros/VBA/ThisDocument`.

**Which stream number contains the macro?** **8**

**What is the name of the stream?** **ThisDocument**

![oledump.py output with stream 8 highlighted showing the M flag on Macros/VBA/ThisDocument](/writeups/thm-squid-game/09-oledump-attacker1-stream8-macro.png)

### Metadata extraction

Running olemeta against the document pulled the embedded metadata fields.
The document's subject was set to **West Virginia Samanta** — likely a
social engineering lure — and the phone number field contained
**213-446-1757**.

Running oletimes showed the last saved timestamp: **2019-02-07 23:45:30**.

Running olevba identified the macro's auto-execution trigger as
**AutoExec** — meaning the macro fires when the document is opened in Word,
not when a specific event occurs.

**What is the subject of the document?** **West Virginia Samanta**

**What is the phone number in the metadata?** **213-446-1757**

**When was this document last saved?** **2019-02-07 23:45:30**

**What is the auto-execution method?** **AutoExec**

### VBA deobfuscation

Extracting the VBA with olevba revealed heavily obfuscated code. The macro
constructs a PowerShell command using `VBA.Shell` and builds the encoded
payload through `ChrW()` function calls and string concatenation:

![olevba output showing VBA.Shell command with ChrW obfuscation and string concatenation](/writeups/thm-squid-game/03-attacker1-vba-chrw-obfuscation.png)

The encoded command itself is a massive string of characters with `[`
brackets used as substitution characters:

![Raw obfuscated PowerShell command extracted from stream 4 showing bracket-substituted Base64](/writeups/thm-squid-game/02-attacker1-obfuscated-powershell.png)

### CyberChef decoding

The deobfuscation required three CyberChef operations chained together:
Find/Replace to swap `[` with `A`, From Base64 to decode the result, and
Remove null bytes to clean up the Unicode encoding. The output was clean
PowerShell:

![CyberChef recipe showing Find/Replace, From Base64, and Remove null bytes producing decoded PowerShell with WebClient DownloadString and DownloadData calls](/writeups/thm-squid-game/04-cyberchef-base64-decode-powershell.png)

The decoded script creates a `System.Net.WebClient` instance and iterates
through its methods looking for `DownloadString` and `DownloadData`. Each
method reaches out to a different indicator.

### Extracted indicators

The `DownloadData` method fetches the payload from the C2 domain:

![Decoded PowerShell showing DownloadData call to fpetraardella.band/xap_102b-AZ1/704e.php?l=litten4.gas](/writeups/thm-squid-game/05-decoded-ps-download-uri.png)

**What is the C2 domain?**
**`fpetraardella.band/xap_102b-AZ1/704e.php?l=litten4.gas`**

The downloaded payload is written to disk as an executable:

![Decoded PowerShell showing GetFolderPath CommonApplicationData path concatenated with QdZGP.exe](/writeups/thm-squid-game/06-decoded-ps-exe-drop-path.png)

**What is the name of the dropped executable?** **QdZGP.exe**

**Which folder is it dropped into?** **%ProgramData%** — the script uses
`[System.Environment]::GetFolderPath("CommonApplicationData")` which
resolves to `C:\ProgramData`.

The script then executes the dropped binary using a COM object identified
by its CLSID:

![Decoded PowerShell showing CLSID C08AFD90-F2A1-11D1-8455-00A0C91F3880 with ShellExecute call](/writeups/thm-squid-game/07-decoded-ps-clsid-shellbrowser.png)

The CLSID `C08AFD90-F2A1-11D1-8455-00A0C91F3880` maps to
**ShellBrowserWindow** — a COM object that provides access to
`Shell.Application` methods, used here to call `ShellExecute` on the
dropped payload. This is a known defense evasion technique: instead of
calling `WScript.Shell` or `cmd.exe` directly (which security tools watch
for), the macro instantiates a COM object by GUID and uses its
`ShellExecute` method.

**What COM object is used for execution?** **ShellBrowserWindow**

The `DownloadString` branch reaches out to a different endpoint — a raw IP:

![Decoded PowerShell showing DownloadString call to http://176.32.35.16/704e.php](/writeups/thm-squid-game/08-decoded-ps-c2-ip.png)

**What is the malicious IP and PHP page?** **176.32.35.16/704e.php**

## Attacker 2 — Reversed commands and DLL sideloading

### Stream analysis

Running oledump.py on `attacker2.doc`:

![oledump.py output for attacker2.doc showing streams 12, 13, 14, 15, 16 marked with M flag](/writeups/thm-squid-game/10-oledump-attacker2-streams.png)

Five streams are flagged with `M`: 12 (`Macros/VBA/Form`), 13
(`Macros/VBA/Module1`), 14 (`Macros/VBA/ThisDocument`), 15
(`Macros/VBA/_VBA_PROJECT`), and 16 (`Macros/VBA/bxh`). The room asks
which streams contain VBA macros — stream 15 is `_VBA_PROJECT` (compiled
code, not source), so the answer excludes it.

**Which streams contain macros?** **12, 13, 14, 16**

The `oledump.py -i` output showed detailed stream sizes. Stream 4
(`1Table`) had a compiled code size of **13867** bytes, and stream 5
(`Data`) was the largest at **63641** bytes.

**What is the compiled code size?** **13867**

**Which stream has the largest bytes?** **63641**

### Macro analysis

The VBA code in this document uses string reversal as its primary
obfuscation. The reversed command, when flipped, reads:

```
cmd /k cscript.exe C:\ProgramData\pin.vbs
```

**What is the reversed command?** **`cmd /k cscript.exe C:\ProgramData\pin.vbs`**

Running olevba extracted the domains the macro reaches out to for payload
retrieval. Two domains serve the initial stage:

**What is the first domain?** **`priyacareers.com/u9hDQN9Yy7g/pt.html`**

**What is the second domain?** **`perfectdemos.com/Gv1iNAuMKZ/pt.html`**

### DLL sideloading chain

The macro downloads multiple DLLs to `C:\ProgramData`. The first one
downloaded is **www1.dll**, and the total count is **5** DLLs. Each DLL is
executed via **rundll32.exe** with a **15**-second sleep between each
execution — a timing-based evasion to avoid sandbox detection, since
automated analysis environments typically have short execution windows.

**What is the first DLL?** **www1.dll**

**How many DLLs are downloaded?** **5**

**Where are the DLLs dropped?** **C:\ProgramData**

**What executable runs the DLLs?** **rundll32.exe**

**How many seconds between each execution?** **15**

The stream containing the obfuscated data that drives this chain is
**Macros/Form/o** — stream 9 in the oledump output.

**What is the stream name containing the obfuscated data?** **Macros/Form/o**

## Attacker 3 — Certutil abuse via ViperMonkey emulation

For this sample, ViperMonkey (vmonkey) was the right tool. Static analysis
of `attacker3.doc` with olevba showed obfuscated VBA, but the
relationships between the macro functions were complex enough that dynamic
emulation was faster than manual deobfuscation.

Running vmonkey against the document emulated the macro execution and
recorded every action:

![ViperMonkey recorded actions showing autoopen entry point, cmd /c set commands with certutil copy operations, and the malicious URI 8cfayv.com/bolb/jaent.php?l=liut6.cab highlighted](/writeups/thm-squid-game/11-vmonkey-attacker3-uri.png)

The recorded actions show the macro's execution chain: it calls `cmd /c`
with `set` to build a command string that uses **Certutil** — a legitimate
Windows certificate utility — to download a file from the attacker's
server. The payload URI is
`8cfayv.com/bolb/jaent.php?l=liut6.cab`, and the downloaded
file is saved as **1.exe** in the **ProgramData** folder.

This is a classic living-off-the-land technique: Certutil is a signed
Microsoft binary present on every Windows installation, so using it to
download files bypasses application whitelisting rules that would block
`curl`, `wget`, or PowerShell's `Invoke-WebRequest`.

**What executable is dropped?** **1.exe**

**What program is used for download?** **Certutil**

**What is the malicious URI?** **`8cfayv.com/bolb/jaent.php?l=liut6.cab`**

**What folder is the payload dropped into?** **ProgramData**

The macro code was stored in stream **A3**.

**Which stream contains the macro?** **A3**

## Attacker 4 — XOR-encrypted COM object strings

This sample used a different obfuscation approach: hex-encoded strings
XOR'd with a key, decoded at runtime to construct COM object names. The
VBA code contained a `CreateObject` call wrapped in custom `XORI` and
`HexToString` functions:

![VBA code showing CreateObject with XORI and HexToString calls, hex values 3F34193F254049193F253A331522 and XOR key 7267417269](/writeups/thm-squid-game/12-attacker4-vba-xori-hex.png)

The two hex strings — `3F34193F254049193F253A331522` as the data and
`7267417269` as the XOR key — were taken to CyberChef. Applying From Hex
followed by XOR with the key `7267417269` (in hex mode) decoded the first
string:

![CyberChef recipe with From Hex and XOR using key 7267417269, output showing MSXML2.XMLHTTP](/writeups/thm-squid-game/13-cyberchef-attacker4-hex-xor.png)

**What is the first decoded string?** **MSXML2.XMLHTTP** — an ActiveX
object for making HTTP requests, used by the macro to download the next
stage.

The same XORI/HexToString pattern was used throughout the macro to hide
every string the macro referenced. Decoding all of them revealed the
full chain: the macro downloads a binary named **DYIATHUQLCW.exe** to the
**TEMP** folder, plus a secondary binary **bin.exe** fetched from
`gv-roth.de/js/bin.exe`.

**What is the dropped binary?** **DYIATHUQLCW.exe**

**What folder is it dropped into?** **TEMP**

**What is the second binary?** **bin.exe**

**What is the full URI for the second binary?** **`gv-roth.de/js/bin.exe`**

## Attacker 5 — Cobalt Strike beacon via shellcode

The final sample was the most layered. ViperMonkey emulation of
`attacker5.doc` revealed a PowerShell command encoded in Base64, launched
with `-nop -w hidden -encodedcommand`:

![ViperMonkey output showing powershell -nop -w hidden -encodedcommand followed by a massive Base64 blob](/writeups/thm-squid-game/14-attacker5-encoded-powershell.png)

The document's caption metadata field contained **CobaltStrikeIsEverywhere**
— a hint at what the shellcode would reveal.

**What is the caption?** **CobaltStrikeIsEverywhere**

Decoding the Base64 payload through CyberChef required multiple stages.
The final decoded layer contained shellcode with an XOR key. The XOR
decimal value was **35**.

**What is the XOR decimal value?** **35**

### Shellcode emulation with scdbgc

The extracted shellcode was saved as `download1.dat` and emulated with
scdbgc. Running it with the default step count showed the initial API calls
but stopped before the full network sequence completed:

![scdbgc with default steps showing LoadLibraryA, InternetOpenA, InternetConnectA to 176.103.56.89:8080, then Stepcount 2000001](/writeups/thm-squid-game/16-scdbgc-default-steps.png)

Increasing the step count to unlimited (`/s -1`) revealed the complete
beacon configuration:

```bash
scdbgc /f ~/Downloads/download1.dat /s -1
```

![scdbgc with unlimited steps showing LoadLibraryA, InternetOpenA, InternetConnectA to 176.103.56.89:8080, HttpOpenRequestA with path /SjMR, and HttpSendRequestA with full User-Agent string](/writeups/thm-squid-game/15-scdbgc-unlimited-steps.png)

The API call sequence tells the full story:

1. **LoadLibraryA(wininet)** — loads the Windows Internet API library
2. **InternetOpenA()** — initialises an internet session
3. **InternetConnectA(server: 176.103.56.89, port: 8080)** — connects to
   the C2 server
4. **HttpOpenRequestA(path: /SjMR)** — crafts the HTTP beacon request
5. **HttpSendRequestA** with User-Agent: `Mozilla/4.0 (compatible; MSIE
   8.0; Windows NT 5.1; Trident/4.0; .NET CLR 2.0.50727)` — sends the
   beacon disguised as Internet Explorer 8 traffic

This is a textbook Cobalt Strike HTTP beacon: a staged payload that loads
wininet.dll, connects to a hardcoded IP on a non-standard port, and checks
in via HTTP with a specific URI path and a spoofed User-Agent string. The
User-Agent deliberately mimics IE8 on Windows XP — old enough to blend
into environments where legacy systems are still running.

**What are the first two API calls?** **LoadLibraryA, InternetOpenA**

**What is the C2 IP?** **176.103.56.89**

**What port does it connect on?** **8080**

**What is the beacon path?** **/SjMR**

**What is the User-Agent?** **`Mozilla/4.0 (compatible; MSIE 8.0; Windows
NT 5.1; Trident/4.0; .NET CLR 2.0.50727)`**

## What I took from this

The room's real lesson is that no single tool handles every maldoc. olevba
gives you the VBA source, but when the code is obfuscated six layers deep
(Attacker 1's ChrW encoding, Attacker 4's XOR-encrypted hex strings),
static extraction is just the starting point — CyberChef does the actual
decoding. ViperMonkey fills the gap when the macro logic is too tangled to
follow manually (Attacker 3's certutil chain, Attacker 5's staged
PowerShell), and scdbgc picks up where ViperMonkey stops — once the
payload is shellcode, macro emulation can't help, but shellcode emulation
reveals the exact API calls and network indicators. The Attacker 5 analysis
drove that home: the default step count in scdbgc wasn't enough to reach
the HTTP request, and without `/s -1` the beacon path and User-Agent would
have been invisible. Knowing when to push a tool past its defaults is as
important as knowing which tool to use.
