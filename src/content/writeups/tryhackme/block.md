---
title: 'Block'
target: 'TryHackMe — Block'
difficulty: 'medium'
date: 2025-08-27
summary: 'A blue-team challenge built around a packet capture of two SMB3-encrypted sessions on a Windows domain. The investigation uses pypykatz to extract NTLM hashes from an lsass dump, cracks the first user''s password to derive the random session key for SMB3 decryption, then uses a Kerberos keytab to decrypt the second user''s traffic without needing to crack their hash at all.'
role: 'forensics'
tags: ['smb3-decryption', 'ntlm', 'pypykatz', 'wireshark', 'kerberos', 'keytab', 'hash-cracking', 'pcap-analysis', 'network-forensics', 'blue-team']
problem: 'A packet capture (traffic.pcapng) contains two SMB3-encrypted sessions from users mrealman and eshellstrop on a Windows domain called BLOCK. An lsass memory dump and a Kerberos keytab file are provided alongside the capture. The goal is to decrypt both SMB3 sessions and extract a flag hidden in each.'
action: 'Used pypykatz to parse the lsass dump and extract NTLM hashes for both users. Cracked mrealman''s hash on CrackStation to recover the plaintext password, then gathered the NTLM authentication values (NTProofStr, Encrypted Session Key, Session ID) from Wireshark and fed them into calc.hash.py to derive the random session key needed for SMB3 decryption. For the second user, skipped hash cracking entirely by loading the provided Kerberos keytab into Wireshark''s KRB5 protocol preferences.'
outcome: 'Decrypted both SMB3 sessions and exported the hidden data. The first session yielded THM{SmB_DeCrypTing_who_Could_Have_Th0ughT} from an exported CSV, and the second yielded THM{No_PasSw0Rd?_No_Pr0bl3m} via the same method. Documented the full decryption workflow for both the session-key approach and the keytab shortcut.'
draft: false
---

## The setup

This is a blue-team forensics room focused entirely on network traffic analysis. The challenge provides three files: a packet capture (`traffic.pcapng`), an lsass memory dump, and a Kerberos keytab (`keytab.kt`). The capture contains SMB3-encrypted traffic from two domain users — **mrealman** and **eshellstrop** — on a Windows domain called **BLOCK**. The job is to decrypt both sessions and find the flags hidden inside.

SMB3 encrypts traffic by default, so opening the pcap in Wireshark shows nothing useful beyond the connection metadata. Decrypting it requires either the random session key (derived from the user's password and several NTLM authentication values) or, for Kerberos-authenticated sessions, the keytab. Each user's session needs a different approach.

---

## First session — mrealman

### Extracting the NTLM hash

The first step is getting credentials out of the lsass dump. Running **pypykatz** against it extracts the logon sessions stored in memory:

![pypykatz output showing mrealman's LogonSession — username mrealman, domain BLOCK, logon server WIN-2258HHCBNQR, with the NT hash 1f9175a516211660c7a8143b0f36ab44 highlighted.](/writeups/thm-block/02-pypykatz-mrealman-nthash.png)

The dump reveals mrealman's NT hash: `1f9175a516211660c7a8143b0f36ab44`. With the hash in hand, the next step is cracking it to recover the plaintext password.

### Cracking the password

Dropping the hash into **CrackStation** returns an instant match:

![CrackStation results — the NTLM hash 1f9175a516211660c7a8143b0f36ab44 cracks to Blockbuster1.](/writeups/thm-block/03-crackstation-blockbuster1.png)

The password is **Blockbuster1**. This is one of two pieces needed to derive the SMB3 session key — the other pieces come from the packet capture itself.

### Gathering the NTLM authentication values

Back in Wireshark, the capture shows mrealman's SMB2 session starting with the standard NTLMSSP handshake. Packet 11 is the `Session Setup Request` carrying the `NTLMSSP_AUTH` message for user `WORKGROUP\mrealman`:

![Wireshark packet list showing the SMB2 session negotiation — packet 11 highlighted as the Session Setup Request with NTLMSSP_AUTH for WORKGROUP\mrealman.](/writeups/thm-block/01-wireshark-smb2-mrealman-session.png)

Expanding the NTLMSSP fields in that packet reveals the values needed for the session key calculation:

![Wireshark NTLM authentication details — NTProofStr: 16e816dead16d4ca7d5d6dee4a015c14, Session Key: fde53b54cb676b9bbf0fb1fbef384698, domain BLOCK, DNS domain block.thm, host DRAGON, target cifs/10.0.2.70.](/writeups/thm-block/05-wireshark-ntlm-auth-details.png)

The two critical values here are the **NTProofStr** (`16e816dead16d4ca7d5d6dee4a015c14`) and the **Encrypted Session Key** (`fde53b54cb676b9bbf0fb1fbef384698`). These, combined with the cracked password, are what `calc.hash.py` needs to derive the random session key.

The Session ID is also required — it ties the decryption key to a specific SMB2 session. Expanding the SMB2 header in the Session Setup Response shows it:

![Wireshark SMB2 Session Setup packet — Session Id: 0x0000010000000041, Acct:mrealman, Domain:WORKGROUP, Host:DRAGON.](/writeups/thm-block/06-wireshark-session-id.png)

### Deriving the random session key

With all the values collected, the next step is feeding them into **calc.hash.py** — a script that computes the SMB3 random session key from the username, domain, password, NTProofStr, and encrypted session key:

![calc.hash.py output — command run with --user administrator --domain jupiter --password Shuttle9812983, producing the Random SK: ba05e83790ffc59a5ada30becc4ea8c8. Below the output, text reads "Inputting this into Wireshark, I was relieved to see that my hard work paid off! The SMB3 packets were decrypted."](/writeups/thm-block/04-calc-hash-random-session-key.png)

The script outputs the **Random SK** (session key): `ba05e83790ffc59a5ada30becc4ea8c8`. This is the key Wireshark needs to decrypt mrealman's SMB3 traffic.

### Importing the session key into Wireshark

In Wireshark's Preferences under **SMB2**, the "Secret session keys for decryption" table accepts a Session ID and Session Key pair. Entering the Session ID (`4100000000100000`) and the random session key (`20a642c086ef74eee26277bf1d0cff8c`):

![Wireshark Preferences — SMB2 protocol settings showing the secret session key table with Session ID 4100000000100000 and Session Key 20a642c086ef74eee26277bf1d0cff8c.](/writeups/thm-block/07-wireshark-smb2-session-key-import.png)

After applying the key, the previously encrypted SMB3 packets become readable. Exporting the decrypted objects and opening the CSV reveals the first flag:

![Exported CSV file — column headers first_name, last_name, password. Row 7 contains Farris Busst with the flag THM{SmB_DeCrypTing_who_Could_Have_Th0ughT} in the password field.](/writeups/thm-block/08-exported-csv-first-flag.png)

```
THM{SmB_DeCrypTing_who_Could_Have_Th0ughT}
```

### The shortcut — NTLMSSP password field

There is actually a faster way to decrypt NTLM-authenticated SMB3 traffic when you have the plaintext password. Instead of computing the session key manually, Wireshark can derive it automatically if you enter the password directly in the **NTLMSSP** protocol preferences:

![Wireshark Preferences — NTLMSSP selected, showing the NT Password field set to Blockbuster1.](/writeups/thm-block/09-ntlmssp-password-shortcut.png)

Setting the NT Password to `Blockbuster1` under NTLMSSP achieves the same decryption without needing `calc.hash.py` at all. This is the simpler approach when you have the cracked password, but the manual method is worth understanding for cases where you have the hash but cannot crack it.

---

## Second session — eshellstrop

### Identifying the second user

Scrolling further into the packet capture reveals a second SMB2 session starting around packet 82, this time from user `WORKGROUP\eshellstrop`:

![Wireshark packet list — packet 82 highlighted as Session Setup Request, NTLMSSP_AUTH for WORKGROUP\eshellstrop, with a new TCP session starting at packet 74.](/writeups/thm-block/10-wireshark-eshellstrop-session.png)

### Extracting eshellstrop's hash

Running pypykatz against the lsass dump again pulls out eshellstrop's credentials:

![pypykatz output showing eshellstrop's LogonSession — username eshellstrop, domain BLOCK, NT hash 3f29138a04aadc19214e9c04028bf381.](/writeups/thm-block/11-pypykatz-eshellstrop-nthash.png)

The NT hash is `3f29138a04aadc19214e9c04028bf381`. Unlike mrealman's hash, this one does not crack on CrackStation or similar services — so the manual session-key approach would require either a longer cracking run or a different technique entirely.

### The keytab approach

This is where the provided **keytab file** comes in. A Kerberos keytab contains the long-term keys for service principals, and Wireshark can use it to decrypt Kerberos-authenticated traffic (including deriving SMB session keys) without needing the user's plaintext password at all.

In Wireshark's Preferences under **KRB5** (Kerberos), enabling "Try to decrypt Kerberos blobs" and pointing the keytab file path to the provided `keytab.kt`:

![Wireshark Preferences — KRB5 protocol settings, "Try to decrypt Kerberos blobs" checked, Kerberos keytab file set to the path of keytab.kt from the challenge evidence.](/writeups/thm-block/12-kerberos-keytab-preferences.png)

After applying the keytab, Wireshark decrypts eshellstrop's SMB3 session automatically. Exporting the decrypted objects and opening the second CSV reveals the final flag:

![Exported CSV file — column headers first_name, last_name, password. Row 7 contains Tonye Risebrow with the flag THM{No_PasSw0Rd?_No_Pr0bl3m} in the password field.](/writeups/thm-block/13-exported-csv-second-flag.png)

```
THM{No_PasSw0Rd?_No_Pr0bl3m}
```

The flag name is fitting — the keytab bypasses the password requirement entirely.

---

## What I took from this

The main lesson from this room is that SMB3 encryption is not as opaque as it looks from the outside. If you have the right pieces — an lsass dump, a cracked password, or a Kerberos keytab — the decryption is methodical rather than difficult. The harder part is knowing which values to extract and where they go. The NTProofStr and Encrypted Session Key are buried several layers deep in the NTLMSSP fields, and it took some research to understand which Wireshark packet fields map to which `calc.hash.py` arguments. The keytab approach for the second user was a good reminder that Kerberos authentication and NTLM authentication need different decryption strategies — and that having the right key material matters more than having the password itself.
