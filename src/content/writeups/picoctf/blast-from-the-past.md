---
title: 'Blast from the past'
target: 'picoCTF — Blast from the past'
difficulty: 'hard'
date: 2026-07-22
summary: "A picoCTF Forensics challenge where all seven EXIF timestamp fields in a JPEG had to be set to Unix epoch, including a Samsung-proprietary TimeStamp stored as raw millisecond bytes that required hex editing after exiftool could only modify the standard six."
role: 'forensics'
tags: ['forensics', 'exif', 'metadata', 'hex-editing', 'exiftool', 'samsung', 'picoctf']
problem: "A JPEG photo taken with a MediaTek camera application on a Samsung device, with timestamps across seven EXIF fields that all needed to be changed to 1970:01:01 00:00:00.001+00:00 — the first millisecond after Unix epoch."
action: "Ran exiftool to inventory all timestamps, used exiftool flags to set the six standard EXIF date fields to epoch, submitted to the checker which validated 6/7 but failed on Samsung TimeStamp, used strings to find the proprietary Image_UTC_Data field storing the timestamp as raw millisecond bytes, hex-edited the value from 1700513181420 to 00001, and resubmitted."
outcome: 'All seven timestamp tags passed validation after the hex edit and the flag was retrieved.'
draft: false
---

## Background

Blast from the past is a picoCTF Forensics challenge about EXIF metadata manipulation. The challenge provides a JPEG photograph and asks the solver to change every timestamp embedded in the image to `1970:01:01 00:00:00.001+00:00` — one millisecond after the Unix epoch. The twist is that the image was taken on a Samsung device, which embeds a proprietary timestamp field that exiftool can read but cannot reliably write, forcing a manual hex edit to complete the challenge.

The image is submitted to a remote checker via netcat (`nc`), which validates each timestamp tag one by one. There are seven tags total, and all seven must match the target value before the flag is released.

---

## Examining the original metadata

Running `exiftool` on the original image revealed it was captured with a MediaTek Camera Application on November 20, 2023:

![Exiftool output showing the Software field as "MediaTek Camera Application" and Modify Date as 2023:11:20 15:46:23.](/writeups/picoctf-blast-from-the-past/01.png)

Scrolling further through the exiftool output revealed Samsung-specific metadata — a Time Stamp field showing `2023:11:20 15:46:21.420-05:00` and MCC Data identifying the carrier region as `United States / Guam (310)`:

![Exiftool output showing Time Stamp as 2023:11:20 15:46:21.420-05:00, MCC Data as United States / Guam (310), Aperture as 1.8, and Image Size as 4000x3000.](/writeups/picoctf-blast-from-the-past/02.png)

The detailed timestamp fields showed that Create Date, Date/Time Original, and Modify Date all carried subsecond precision at `2023:11:20 15:46:23.703`:

![Exiftool output showing Create Date, Date/Time Original, and Modify Date all set to 2023:11:20 15:46:23.703.](/writeups/picoctf-blast-from-the-past/03.png)

The challenge required changing all of these — plus their subsecond variants and the Samsung TimeStamp — to exactly `1970:01:01 00:00:00.001`.

---

## Setting the standard EXIF timestamps

Exiftool supports writing to all six standard EXIF date fields in a single command. Used `-AllDates` as a shortcut for the three primary fields (CreateDate, DateTimeOriginal, ModifyDate), then explicitly set each subsecond variant to include the `.001` millisecond precision:

![Terminal showing the exiftool command with flags -AllDates, -CreateDate, -DateTimeOriginal, -ModifyDate, -SubSecCreateDate, -SubSecDateTimeOriginal, and -SubSecModifyDate all set to 1970:01:01 00:00:00.001, applied to original.jpg.](/writeups/picoctf-blast-from-the-past/04.png)

The full command was:

```
exiftool -AllDates='1970:01:01 00:00:00.001' -CreateDate='1970:01:01 00:00:00.001' -DateTimeOriginal='1970:01:01 00:00:00.001' -ModifyDate='1970:01:01 00:00:00.001' -SubSecCreateDate='1970:01:01 00:00:00.001' -SubSecDateTimeOriginal='1970:01:01 00:00:00.001' -SubSecModifyDate='1970:01:01 00:00:00.001' original.jpg
```

This covered the six standard fields. The modified image was then submitted to the checker using netcat:

```
nc -w 2 mimas.picoctf.net 55107 < original.jpg
nc mimas.picoctf.net 59807
```

---

## The Samsung TimeStamp problem

The checker validated the first six tags successfully, but failed on the seventh:

![Checker output showing tags 5/7 (SubSecDateTimeOriginal) and 6/7 (SubSecModifyDate) both passing with "Great job, you got that one!" but tag 7/7 (Samsung TimeStamp) failing. The checker expected 1970:01:01 00:00:00.001+00:00 but found 2023:11:20 20:46:21.420+00:00.](/writeups/picoctf-blast-from-the-past/05.png)

Tag 7 was the Samsung TimeStamp — a proprietary metadata field that Samsung devices embed in their JPEG files. The checker was looking for `1970:01:01 00:00:00.001+00:00` but still found the original timestamp `2023:11:20 20:46:21.420+00:00`. The exiftool command had not touched this field because Samsung stores it differently from the standard EXIF date tags — it is not one of the fields that `-AllDates` or the standard date flags cover, and writing to it directly through exiftool does not always produce the correct binary format that Samsung's implementation expects.

---

## Finding the Samsung timestamp in the binary

Since exiftool could not reliably modify the Samsung TimeStamp, the next step was to locate it in the raw file data. Running `strings` on the JPEG revealed the proprietary field names Samsung embeds:

![Strings output from the JPEG showing Image_UTC_Data1700513181420, MCC_Data310, and Camera_Capture_Mode_Info1SEFHk.](/writeups/picoctf-blast-from-the-past/06.png)

The field `Image_UTC_Data` was immediately followed by the value `1700513181420` — a Unix timestamp in milliseconds. Converting this confirmed it matched the original capture time: `1700513181420 ms` from epoch is `2023-11-20 20:46:21.420 UTC`, exactly what the checker had reported for tag 7. The Samsung TimeStamp was stored not as a formatted date string but as a raw millisecond count embedded directly in the file's binary data, concatenated with the field name.

To set this to one millisecond after epoch (`1970:01:01 00:00:00.001+00:00`), the value needed to become `1` — but since the field occupied a fixed byte length, the replacement had to be zero-padded to maintain the same number of characters. The target value was `00001` (representing 1 millisecond).

---

## Hex editing the Samsung timestamp

Opened the JPEG in a hex editor and located the `Image_UTC_Data` field. The ASCII representation on the right side of the hex view made it easy to find — the string `Image_UTC_D` appeared at offset `0x002B8FB0`, with `ata` continuing on the next line at `0x002B8FC0`, immediately followed by the timestamp bytes:

![Hex editor showing the Image_UTC_Data field at offset 0x002B8FB0. The bytes at 0x002B8FC0 show "ata" followed by "00001" highlighted in orange/brown, with the remaining bytes zeroed out. Below it, MCC_Data310 and Camera_Capture_Mode_Info1SEFHk are visible.](/writeups/picoctf-blast-from-the-past/07.png)

The original value `1700513181420` was replaced with `00001` followed by null bytes to fill the remaining space. This set the Samsung UTC timestamp to 1 millisecond after epoch — exactly what the checker required.

---

## Successful submission

After saving the hex-edited file, submitted it to the checker again via netcat. This time, all seven tags passed validation:

![Checker output showing tags 5/7 (SubSecDateTimeOriginal), 6/7 (SubSecModifyDate), and 7/7 (Samsung TimeStamp) all passing. The Samsung TimeStamp now shows Found: 1970:01:01 00:00:00.001+00:00, matching the expected value. The output ends with "You did it!" followed by the flag, which is obscured by a red scribble.](/writeups/picoctf-blast-from-the-past/08.png)

The Samsung TimeStamp now reported `1970:01:01 00:00:00.001+00:00`, matching the expected value. All seven tags were validated and the flag was retrieved.

---

## What I took from this

This challenge highlighted the gap between what metadata tools can do and what is actually embedded in a file's binary structure. Exiftool is an extraordinarily capable tool — it reads and writes hundreds of metadata formats across dozens of file types — but vendor-specific extensions like Samsung's `Image_UTC_Data` field can fall outside its reliable write capabilities. The field was stored as raw ASCII bytes representing a Unix timestamp in milliseconds, concatenated directly with the field name in the file's binary data, rather than as a structured EXIF tag with a defined type and offset in the IFD (Image File Directory). This meant that modifying it required understanding the binary layout and making a precise hex edit rather than relying on a high-level tool.

The challenge also reinforced the importance of understanding how timestamps are represented at different layers. The standard EXIF fields used a human-readable format (`YYYY:MM:DD HH:MM:SS.sss`), while the Samsung field used a machine-oriented format (milliseconds since epoch). Both encoded the same moment in time, but modifying one did not affect the other because they were stored independently in different parts of the file. In forensic analysis, this kind of timestamp inconsistency — where standard EXIF dates say one thing but a vendor-specific field says another — is a strong indicator of metadata tampering. If an investigator only checked the standard fields and missed the Samsung-proprietary ones, they could be misled about when a photo was actually taken. The broader lesson is that forensic examination of image metadata must go beyond the standard EXIF tags and account for vendor-specific extensions, maker notes, and binary-level artifacts that survive high-level metadata edits.
