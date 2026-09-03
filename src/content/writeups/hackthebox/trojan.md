---
title: 'Trojan'
target: 'Hack The Box — Trojan'
difficulty: 'medium'
date: 2026-02-15
summary: 'An HTB Sherlock — investigating a compromised Windows 10 workstation where user John Grunewald downloaded a trojanised file recovery tool. Correlated evidence across a memory dump (Volatility 3), network capture (Zeek/Wireshark), and Prefetch files to reconstruct the infection chain from Data_Recovery.zip download through InnoSetup-based trojan execution to C2 communications with three attacker servers.'
role: 'soc'
tags: ['memory-forensics', 'volatility', 'pcap', 'wireshark', 'zeek', 'malware-analysis', 'virustotal', 'prefetch', 'pecmd', 'trojan', 'innosetup', 'c2', 'finalrecovery', 'windows-forensics', 'dfir', 'sherlock']
problem: 'A multi-source forensic investigation into a compromised Windows 10 workstation. John Grunewald downloaded a trojanised recovery tool that established C2 communications. Evidence includes a memory dump, network capture, and Prefetch files requiring correlation across Volatility 3, Zeek/Wireshark, PECmd, and threat intelligence platforms.'
action: 'Volatility 3 windows.info confirmed Windows 10 build 19041 with SystemTime 2023-05-30 02:09:03 UTC. Recovered hostname DESKTOP-38NVPD0 from NetBIOS registration packets in the PCAP. Zeek HTTP log analysis revealed the machine downloaded Data_Recovery.zip from praetorial-gears.000webhostapp.com. Volatility pstree located Recovery_Setup.exe (PID 484) with InnoSetup child processes (is-NJBAT.tmp, is-VIBV9.tmp). SHA-256 hash C34601C5...A503CA was computed and submitted to VirusTotal/Malware Bazaar, confirming the trojan masquerades as FinalRecovery v3.0.7.0325. PECmd showed first execution at 02:06:29 UTC with run count 2. Zeek HTTP logs filtered for PHP endpoints mapped three C2 servers (45.12.253.56, .72, .75) across four malicious URLs confirmed by VirusTotal, with dll.php on 45.12.253.75 serving binary payloads.'
outcome: 'Reconstructed the full infection chain: download from a free hosting staging site, InnoSetup-based trojan masquerading as FinalRecovery, first execution at 02:06:29 UTC, and active C2 with three servers across four PHP endpoints. No single evidence source told the complete story -- correlation across memory, network, and disk was required.'
draft: false
---

## Background

Trojan is a Hack The Box Sherlock — a multi-source forensic investigation into a compromised Windows 10 workstation. The scenario is one that plays out in organisations every day: an employee named John Grunewald accidentally deleted important accounting documents, panicked, and turned to the internet for a recovery solution. He found what appeared to be a legitimate file recovery tool, downloaded it, and ran it — except the installer was trojanised, bundling actual recovery software with a backdoor that silently established command-and-control communications. When his PC started behaving strangely afterwards, John alerted the IT department, who locked down the workstation and collected three categories of forensic evidence: a full memory dump (memory.vmem), a network packet capture (network.pcapng), and disk artefacts including Windows Prefetch files. The investigation requires weaving all three evidence sources together to reconstruct the complete infection chain.

---

## Establishing the system baseline with Volatility

The first step in any memory forensics investigation is understanding what system the dump came from. Running Volatility 3's `windows.info` plugin against the memory dump provides the operating system profile, architecture, and system state at the time of capture:

```bash
sudo python3 /opt/volatility3-develop/vol.py -f memory.vmem windows.info
```

![Terminal showing Volatility 3 Framework 2.26.1 output for windows.info plugin against memory.vmem with PDB scanning finished at 100 percent. The output shows Kernel Base 0xf8073e400000, DTB 0x1ad000, Symbols file ntkrnlmp.pdb, Is64Bit True, IsPAE False, layer_name WindowsIntel32e, memory_layer VmwareLayer, base_layer and meta_layer as FileLayer, KdVersionBlock 0xf8073f00f368, Major/Minor 15.19041, MachineType 34404, KeNumberProcessors 2, SystemTime 2023-05-30 02:09:03+00:00, NtSystemRoot C:\Windows, NtProductType NtProductWinNt, NtMajorVersion 10, NtMinorVersion 0, PE MajorOperatingSystemVersion 10, PE Machine 34404, PE TimeDateStamp Wed Jan 4 04:27:11 1995.](/writeups/htb-trojan/01.png)

The output confirms Windows 10 build **19041** (the May 2020 Update, version 2004) running in a 64-bit configuration with 2 processors. The SystemTime of 2023-05-30 02:09:03 UTC establishes the capture timestamp, and the VmwareLayer in the memory layer stack tells us this workstation was running inside a VMware virtual environment. The kernel base at 0xf8073e400000 and DTB (Directory Table Base) at 0x1ad000 are the architectural anchors Volatility uses to translate virtual addresses to physical offsets throughout the rest of the analysis.

---

## Recovering the hostname from network traffic

With the system profiled, the next step is identifying the machine's hostname. While Volatility can extract this from registry hives, the PCAP offers a faster route through NetBIOS Name Service traffic. Windows machines broadcast NetBIOS name registrations when they join a network, and these broadcasts contain the machine's hostname in cleartext. Applying the Wireshark display filter `ip.addr == 192.168.116.133` to isolate the compromised machine's traffic and examining the NBNS packets reveals the registration:

![Wireshark displaying network.pcapng with display filter ip.addr == 192.168.116.133 applied. Packet 54 is expanded showing UDP payload of 68 bytes containing a NetBIOS Name Service registration with Transaction ID 0x8922, Flags 0x2900 Opcode Registration with Recursion desired, Questions 1, Answer RRs 0, Authority RRs 0, Additional RRs 1. The Queries section highlighted in red shows DESKTOP-38NVPD0 type NB class IN, with Name DESKTOP-38NVPD0 identified as Workstation/Redirector, Type NB (32), Class IN (1).](/writeups/htb-trojan/02.png)

The NetBIOS registration packet confirms the hostname: **DESKTOP-38NVPD0**, registered as a Workstation/Redirector (the standard NetBIOS suffix for Windows workstations). The Opcode field shows Registration with Recursion desired, meaning this was the machine announcing itself to the network — a reliable and tamper-resistant source of hostname information since it comes from the operating system's own network stack.

---

## Identifying the malicious download with Zeek

The scenario tells us John downloaded recovery software from the internet. To find exactly what he downloaded, processing the PCAP through Zeek generates structured HTTP logs that are far easier to query than raw packet data. Using zeek-cut to extract the origin host, response host, URI, and host fields, then filtering for ZIP file downloads, surfaces the malicious download immediately:

```bash
cat http.log | zeek-cut id.orig_h id.resp_h uri host | grep zip
```

![Terminal on the monitoring virtual machine showing the zeek-cut command output. A single result shows origin IP 192.168.116.133 connecting to response IP 145.14.144.155 and downloading from the path /wp-content/uploads/2023/05/Data_Recovery.zip, with the filename highlighted in red and the partial host praetorial-gears visible in green.](/writeups/htb-trojan/03.png)

The compromised machine at 192.168.116.133 downloaded **Data_Recovery.zip** from 145.14.144.155 via the path `/wp-content/uploads/2023/05/`. The `/wp-content/uploads/` directory structure immediately identifies this as a WordPress site being used to host the malicious file — either a compromised legitimate WordPress installation or a purpose-built staging site. Running the same zeek-cut command with the host field more visible confirms the full domain:

![Terminal showing the same zeek-cut command output with the host field fully visible. The origin IP 192.168.116.133 connected to 145.14.144.155, downloaded Data_Recovery.zip from the WordPress uploads path, and the host field shows praetorial-gears.000webhostapp.com highlighted in blue.](/writeups/htb-trojan/04.png)

The full domain is **praetorial-gears.000webhostapp.com** — hosted on the 000webhostapp.com free hosting platform. Free hosting services are a favourite staging ground for malware distribution because accounts are disposable, infrastructure is shared (making IP-based blocking difficult without collateral damage), and there is minimal verification of uploaded content. The archive name Data_Recovery.zip was specifically crafted to match what John was searching for — a textbook social engineering technique where the attacker anticipates the victim's need and provides a convincingly named payload.

---

## Tracing the malicious process in memory

With the downloaded file identified, Volatility's pstree plugin reveals what happened when John extracted and executed the archive's contents. Filtering the process tree for references to the downloaded archive name narrows the output to the relevant processes:

```bash
sudo python3 /opt/volatility3-develop/vol.py -f memory.vmem windows.pstree | grep -i data
```

![Terminal showing Volatility pstree output filtered with grep -i data. The output shows several processes including OneDriveStandaloneUpdater.exe with standard paths. Highlighted in red is Recovery_Setup.exe at virtual offset 0xb38176d4d080 with PID 484, created at 2023-05-30 02:07:59.000000 UTC, running from the path C:\Users\John\Downloads\Data_Recovery\Recovery_Setup.exe. Below it, child processes are visible including is-NJBAT.tmp at PID 5930 spawned at the same timestamp, with paths showing C:\Users\John\AppData\Local\Temp\ temporary directories, and Recovery_Setup.exe also appearing with file size 1937767 and hash reference. Further down, msedge.exe processes appear with standard Edge browser paths and arguments.](/writeups/htb-trojan/05.png)

The process tree tells the complete execution story. **Recovery_Setup.exe** is running with PID **484**, created at 2023-05-30 02:07:59 UTC, launched from the path **C:\Users\John\Downloads\Data_Recovery\Recovery_Setup.exe** — exactly where Windows would extract a ZIP file downloaded through a browser. The process has spawned child processes including is-NJBAT.tmp (PID 5930) and associated temporary files, all created at the same timestamp. The is-NJBAT.tmp and is-VIBV9.tmp naming pattern is the signature of InnoSetup, a legitimate open-source installer framework that threat actors frequently repurpose to package malware. InnoSetup creates randomised temporary extraction directories under `%LOCALAPPDATA%\Temp\` with the is-*.tmp naming convention during installation — so while the installer framework is legitimate, the payload it delivers is not.

---

## Computing the SHA-256 hash

To fingerprint the malicious executable for threat intelligence lookups, the Recovery_Setup.exe binary was extracted from the evidence and its SHA-256 hash computed using PowerShell's `Get-FileHash` cmdlet:

```powershell
Get-FileHash .\Recovery_Setup.exe
```

![PowerShell window on an analysis workstation showing the Get-FileHash command output. The Algorithm column shows SHA256, the Hash column displays C34601C5DA3501F6EE0EFCE18DE7E6145153ECFAC2CE2019EC52E1535A4B3193, and the Path column shows C:\Users\Analysis\Desktop\New folder\Recovery_Setup.exe.](/writeups/htb-trojan/06.png)

The SHA-256 hash is `C34601C5DA3501F6EE0EFCE18DE7E6145153ECFAC2CE2019EC52E1535A4B3193`. This serves as the unique cryptographic fingerprint for correlating the sample across threat intelligence platforms — VirusTotal, Malware Bazaar, and any other repository that indexes malware by hash.

---

## Analysing execution history through Prefetch

Windows Prefetch files (.pf) are forensic gold for establishing execution timelines. Every time an executable runs, Windows creates or updates a Prefetch file that records the first and last execution timestamps, total run count, and all files and directories referenced during the first ten seconds of execution. Parsing the RECOVERY_SETUP.EXE prefetch file with PECmd (Eric Zimmerman's Prefetch parser from the DFIR forensic toolkit) revealed that the malicious installer was first executed at **2023-05-30 02:06:29** UTC and ran a total of **2** times. The first execution at 02:06:29 predates the pstree creation time of 02:07:59 by roughly 90 seconds — this gap is expected because Prefetch timestamps record when the executable image starts loading from disk, while the pstree creation time reflects when the process object is fully initialised in the kernel's process table. The run count of 2 suggests John executed the installer twice, possibly because the first run appeared to finish without producing visible results (the trojan was silently establishing its C2 channel behind the recovery interface) and he tried again hoping it would work.

---

## Identifying the temporary files in memory

The malicious InnoSetup installer creates temporary files during its extraction and execution process. Running strings against the memory dump and filtering for .tmp references reveals all temporary file artefacts still resident in memory:

```bash
sudo strings memory.vmem | grep tmp
```

![Terminal showing strings output from the memory dump filtered for tmp references. Multiple entries show C:\Users\John\AppData\Local\Temp\is-VIBV9.tmp\is-NJBAT.tmp paths. A JSON structure is visible containing displayText is-NJBAT.tmp, activationUri ms-shellactivity, appDisplayName is-NJBAT.tmp, backgroundColor black. Below that, C:/tmp and additional C:\Users\John\AppData\Local\Temp\ paths are visible with partially redacted subdirectory names.](/writeups/htb-trojan/07.png)

The strings output confirms both temporary files created by the malicious installer: **IS-NJBAT.TMP** and **is-VIBV9.tmp**, both located under `C:\Users\John\AppData\Local\Temp\`. The directory structure shows is-NJBAT.tmp nested inside the is-VIBV9.tmp extraction directory, which is the standard InnoSetup pattern — the outer tmp directory (is-VIBV9.tmp) serves as the extraction root, while the inner file (IS-NJBAT.TMP) is the actual installer payload that performs the setup. The JSON structure visible in the strings output is particularly interesting: it shows IS-NJBAT.TMP registered with an `activationUri` of `ms-shellactivity` and an `appDisplayName` of is-NJBAT.tmp with a `backgroundColor` of black. This metadata indicates the installer registered itself as a Windows shell activity handler — a technique that allows the application to be invoked through the Windows activation framework, potentially serving as a persistence mechanism or a way to re-trigger execution through legitimate system channels.

---

## Mapping the C2 infrastructure

With the malware identified and its execution timeline established, the final investigative phase focuses on what the trojan did after installation — specifically, what command-and-control servers it communicated with. Returning to the Zeek HTTP logs and filtering for PHP endpoints — the standard server-side language for C2 web panels — reveals the full scope of post-infection communications:

```bash
cat http.log | zeek-cut id.orig_h id.resp_h uri host | grep php
```

![Terminal showing Zeek HTTP log output filtered for PHP endpoints. The compromised machine at 192.168.116.133 contacted three distinct C2 servers: 45.12.253.56 with URI /advertising/plus.php containing query parameters s=NOSUB and str=mixtwo and substr=mixinte with host 45.12.253.56, then 45.12.253.72 with /default/stuk.php and /default/puk.php endpoints with host 45.12.253.72, and finally 45.12.253.75 with /dll.php repeated many times filling the terminal output, each showing host 45.12.253.75 indicating persistent beaconing or chunked binary download.](/writeups/htb-trojan/08.png)

The compromised machine communicated with three distinct C2 servers, each serving a different role in the malware's infrastructure. The first server at 45.12.253.56 hosted `/advertising/plus.php` with query parameters `s=NOSUB&str=mixtwo&substr=mixinte` — likely a check-in beacon transmitting encoded system fingerprint data to identify the compromised machine to the attacker's panel. The second server at 45.12.253.72 hosted two endpoints: `/default/stuk.php` and `/default/puk.php`, serving as command retrieval and payload staging endpoints. The third server at 45.12.253.75 served `/dll.php` repeatedly — the volume of connections to this endpoint (filling the entire terminal output) indicates binary payload delivery, consistent with the endpoint name suggesting it serves DLL (Dynamic Link Library) modules. The malware downloaded its binary payload through the **dll.php** endpoint, with the repeated connections suggesting either chunked transfer of a large binary or periodic checks for updated modules.

---

## Correlating with VirusTotal threat intelligence

To validate which of the contacted URLs are known-malicious versus legitimate, the URLs were cross-referenced against VirusTotal's URL scanning database. The results clearly separated the C2 infrastructure from normal Windows certificate validation traffic:

![VirusTotal URL scan results table showing Scanned dates, Detections, Status, and URL columns. Four URLs are flagged as malicious: http://45.12.253.72/default/puk.php with 12 out of 97 detections scanned 2025-05-17, http://45.12.253.75/dll.php with 12 out of 97 detections scanned 2025-05-19, http://45.12.253.72/default/stuk.php with 12 out of 97 detections scanned 2025-05-19, and http://45.12.253.56/advertising/plus.php with query parameters showing 11 out of 97 detections scanned 2025-05-19. Four URLs are clean with 0 out of 97 detections: http://www.microsoft.com/pki/certs/MicCodSigPCA_08-31-2010.crt with Status 200, http://crt.sectigo.com/SectigoPublicCodeSigningCAR36.crt with Status 200, http://crt.sectigo.com/SectigoPublicCodeSigningRootR46.p7c with Status 200, and http://www.microsoft.com/pki/certs/MicrosoftTimeStampPCA.crt with Status 200 scanned 2025-05-15.](/writeups/htb-trojan/09.png)

**4** of the contacted URLs were detected as malicious by VirusTotal: puk.php (12/97), dll.php (12/97), stuk.php (12/97), and plus.php (11/97). The remaining URLs — Microsoft PKI certificate endpoints (MicCodSigPCA_08-31-2010.crt and MicrosoftTimeStampPCA.crt) and Sectigo code-signing certificates (SectigoPublicCodeSigningCAR36.crt and SectigoPublicCodeSigningRootR46.p7c) — all returned 0/97 detections with HTTP 200 status codes. These legitimate certificate fetches are part of Windows' standard code-signing verification pipeline: when any executable runs, the operating system attempts to validate its digital signature chain by downloading the relevant certificate authority certificates, regardless of whether the executable's signature is valid, expired, or entirely absent. The presence of these legitimate requests mixed with C2 traffic is normal and expected.

---

## Identifying the masqueraded application

The final piece of the investigation is understanding what the trojan was pretending to be. Submitting the SHA-256 hash to Malware Bazaar (abuse.ch) returned detailed intelligence on the sample, including its masquerading identity:

![VirusTotal or Malware Bazaar analysis showing the file is marked Malicious false in the clean scanner context, with a Preview section displaying the program metadata: FinalRecovery v3.0.7.0325 with an Overview description stating FinalRecovery is a powerful and easy-to-use file recovery software suitable for various data recovery situations including recovering accidentally deleted files from Windows Explorer, command line, and other software utilities, recovering files lost while emptying the Recycle Bin, recovering file losses caused by unknown reasons, recovering files from accidentally formatted disk volumes, recovering files from corrupted partitions, recovering files from drive image files, and predicting drive failures. It supports FAT12 FAT16 FAT32 NTFS NTFS5 and Raw file system and can recover files from hard disks floppies removable hard drives U disks and PCMCIA devices.](/writeups/htb-trojan/10.png)

The trojan masquerades as **FinalRecovery v3.0.7.0325**, a legitimate file recovery utility developed by FinalRecovery Software. The real FinalRecovery application is designed for exactly the situation John found himself in — recovering accidentally deleted files from hard disks, USB drives, and damaged partitions across FAT12, FAT16, FAT32, NTFS, NTFS5, and Raw file systems. The threat actor cloned FinalRecovery's version string, branding, and application metadata into the trojanised InnoSetup installer, so when John ran Recovery_Setup.exe, he saw what appeared to be a genuine recovery tool installing and operating normally. Meanwhile, the malware silently established its C2 communications with the three attacker-controlled servers in the background, turning John's attempt to fix his mistake into a full-blown compromise.

---

## What I took from this

Trojan is a textbook example of how threat actors exploit human psychology as much as technical vulnerabilities. John wasn't tricked by a sophisticated zero-day or a targeted spear-phishing campaign — he was in a panic after deleting important files and searched for a solution, and the attacker had already positioned a convincingly named, professionally packaged trojan on a free hosting platform waiting for exactly that kind of search. The investigation required stitching together three independent evidence sources — memory, network, and disk — because no single artefact told the complete story. The memory dump revealed the running processes and their parent-child relationships, the network capture showed what was downloaded and where the malware was communicating, and the Prefetch files established the precise execution timeline. The C2 infrastructure itself demonstrated operational discipline: three separate servers with distinct roles (beaconing, command retrieval, payload delivery), PHP-based panels on dedicated IPs, and communication patterns designed to blend with legitimate Windows certificate-validation traffic. The case reinforced a fundamental forensic principle: always correlate across evidence sources, because the attacker controls what each individual artefact shows, but the inconsistencies between sources are where the truth emerges.
