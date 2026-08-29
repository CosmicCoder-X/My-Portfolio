---
title: 'Dreaming'
target: 'TryHackMe — Dreaming'
difficulty: 'easy'
date: 2025-08-29
summary: 'An easy Linux box themed around The Sandman — initial access through Pluck 4.7.13 CMS with default credentials and a known file upload vulnerability (ExploitDB 49909) to get a web shell as www-data, then lateral movement through three users: credential reuse from a Python script to SSH as lucien, command injection through a MySQL INSERT into a subprocess-executed query to move to death via sudo, and Python library hijacking of shutil.py to read the final flag as morpheus.'
role: 'pentest'
tags: ['pluck-cms', 'file-upload', 'command-injection', 'mysql', 'lateral-movement', 'privilege-escalation', 'python-library-hijacking', 'credential-reuse', 'sudo', 'webshell']
problem: 'A Linux machine running Apache with Pluck 4.7.13 CMS hidden behind a directory listing. The box requires chaining multiple lateral movement techniques across three user accounts — lucien, death, and morpheus — each protected by a different escalation mechanism: credential reuse, command injection through a database-backed script executed via sudo, and Python library hijacking through a writable system module.'
action: 'Enumerated the target with Nmap finding SSH on port 22 and Apache on port 80. Discovered the /app directory with Gobuster leading to Pluck 4.7.13. Logged into the CMS admin panel with the default password, then exploited a known file upload vulnerability (ExploitDB 49909) to upload a .phar web shell and gain execution as www-data. Found MySQL credentials in /opt/getDreams.py and Pluck login credentials in /opt/test.py. Used the Pluck password to SSH as lucien. Discovered MySQL credentials in lucien bash history, connected to the library database, and injected a command into the dreams table that was executed by getDreams.py when run with sudo as death. As death, found restore.py importing shutil.copy2 and modified the system shutil.py to chmod the final flag file, then read it.'
outcome: 'Rooted the box — retrieved lucien flag THM{TH3_L1BR4R14N}, retrieved death flag, and retrieved morpheus flag THM{DR34MS_5H4P3_TH3_W0RLD}. The attack chain moved through four privilege levels (www-data to lucien to death to morpheus) using four distinct techniques (file upload RCE, credential reuse, command injection via SQL, and Python library hijacking).'
draft: false
---

## Background

Dreaming is a Matrix/Sandman-themed box that's less about any single difficult exploit and more about chaining lateral movements. Each user account is a stepping stone that requires a different technique to reach the next — credential reuse, command injection through a database, and Python library hijacking. The initial foothold is straightforward, but the path from www-data to the final flag touches enough different concepts to make it a solid learning exercise.

---

## Enumeration

Nmap shows two open ports: SSH on 22 and Apache httpd 2.4.41 on 80 running Ubuntu.

![Nmap scan results showing port 22 running OpenSSH 8.2p1 and port 80 running Apache httpd 2.4.41 on Ubuntu, with service version details and SSH host keys.](/writeups/thm-dreaming/01-nmap-scan.png)

The web server serves the default Apache page. Running Gobuster against it finds **/app** returning a 301 redirect.

![Gobuster directory scan showing the discovered /app directory with Status 301 and Size 310.](/writeups/thm-dreaming/02-gobuster-app.png)

Navigating to `/app` reveals a Pluck 4.7.13 CMS installation. The admin panel at `/app/pluck-4.7.13/login.php` accepts the default password, granting full administrative access.

![The Pluck 4.7.13 CMS admin panel after successful login, showing the dashboard with options for pages, modules, theme settings, and administration.](/writeups/thm-dreaming/03-pluck-admin-panel.png)

---

## Initial access — Pluck file upload RCE

Pluck 4.7.13 has a known file upload vulnerability documented as ExploitDB 49909. The CMS allows uploading `.phar` files through the file manager, which Apache executes as PHP. Uploading a p0wny web shell as `shell.phar` gives command execution as **www-data**.

![The p0wny@shell web shell running as www-data in /var/www/html/app/pluck-4.7.13/files, with shell.phar visible in the directory listing alongside other uploaded files.](/writeups/thm-dreaming/04-webshell-www-data.png)

---

## Lateral movement — www-data to lucien

Exploring the filesystem, `/opt` contains two interesting Python scripts. The first is `getDreams.py`, which connects to a MySQL database using hardcoded credentials — the database user is **death**, the database name is **library**, and the script queries `SELECT dreamer, dream FROM dreams`.

![The getDreams.py script showing MySQL connection parameters — DB_USER set to death, DB_PASS with the database password, and DB_NAME set to library, followed by a query selecting dreamer and dream columns from the dreams table.](/writeups/thm-dreaming/05-getdreams-mysql-creds.png)

The critical vulnerability in this script is how it processes the query results. It builds a command string using an f-string and passes it directly to `subprocess.check_output()` with `shell=True` — meaning any shell metacharacters stored in the database will be executed as commands.

![The second half of getDreams.py showing the subprocess.check_output call with command constructed via f-string and shell=True, creating a command injection vulnerability through database content.](/writeups/thm-dreaming/06-getdreams-command-injection.png)

The second script is `test.py`, which makes a POST request to Pluck's login page with credentials. The password in this script belongs to the **lucien** user account on the system.

![The test.py script showing a requests.post call to the Pluck login.php page with a password parameter.](/writeups/thm-dreaming/07-test-py-pluck-creds.png)

Using the password from `test.py` to SSH in as lucien works — credential reuse across the CMS and the system account. The first flag is in lucien's home directory.

![SSH session as lucien showing the home directory listing and the contents of lucien_flag.txt displaying THM{TH3_L1BR4R14N}.](/writeups/thm-dreaming/08-lucien-flag.png)

---

## Lateral movement — lucien to death

Checking lucien's `.bash_history` reveals a MySQL login command with the password visible in the command line — a common operational security failure where credentials end up in shell history.

![Lucien's .bash_history showing a mysql command with the -u lucien flag and password visible, along with sudo commands and getDreams.py execution.](/writeups/thm-dreaming/09-bash-history-mysql.png)

Connecting to MySQL with lucien's credentials and examining the **library** database shows the **dreams** table containing entries from Alice, Bob, Carol, and Dave.

![MySQL session showing the library database with a single dreams table, and SELECT * output showing four rows — Alice through Dave with their dream descriptions.](/writeups/thm-dreaming/10-mysql-dreams-table.png)

The escalation path connects two pieces: the `getDreams.py` script executes database content through `subprocess` with `shell=True`, and `sudo -l` shows lucien can run `getDreams.py` as **death** without a password. Inserting a command injection payload into the dreams table — `INSERT INTO dreams VALUES ("injected","$(/bin/bash)")` — and then running the script with `sudo -u death /opt/getDreams.py` triggers command execution as death.

![MySQL INSERT command injecting a $(/bin/bash) payload into the dreams table, followed by sudo -l output showing lucien can run getDreams.py as death with NOPASSWD, and the script execution result.](/writeups/thm-dreaming/11-mysql-injection-sudo.png)

---

## Privilege escalation — death to morpheus

With a shell as death, the death flag in `/home/death/death_flag.txt` was retrieved. Exploring further, death can access `/home/morpheus` which contains `morpheus_flag.txt` (not readable), a `kingdom` directory, and `restore.py`.

![Shell as death showing chmod 777 on getDreams.py, navigation to /home/death with death_flag.txt and getDreams.py visible.](/writeups/thm-dreaming/12-death-shell-chmod.png)

![Directory listing of /home/morpheus showing kingdom directory, morpheus_flag.txt (permission denied when read), and restore.py — a backup script using shutil.copy2 to copy files from /home/morpheus/kingdom to /kingdom_backup/kingdom.](/writeups/thm-dreaming/13-morpheus-home-restore.png)

The `restore.py` script imports `shutil` and calls `shutil.copy2()` to back up files. The key observation is that `/usr/lib/python3.8/shutil.py` — the system library file — is writable. This opens a **Python library hijacking** vector: modifying the system `shutil.py` to include malicious code that executes when `restore.py` imports it.

Adding `os.system("chmod 777 /home/morpheus/morpheus_flag.txt")` to the system `shutil.py` means the next time `restore.py` runs (likely via a cron job as morpheus), it imports the modified library and changes the flag file's permissions.

![The modified /usr/lib/python3.8/shutil.py with the injected os.system command to chmod 777 the morpheus flag file, highlighted in green.](/writeups/thm-dreaming/14-shutil-hijack.png)

After the script runs, the flag becomes readable.

![The contents of morpheus_flag.txt displaying THM{DR34MS_5H4P3_TH3_W0RLD}.](/writeups/thm-dreaming/15-morpheus-flag.png)

---

## What I took from this

The box is a clean demonstration of how lateral movement works in practice. No single step is particularly hard — default credentials, credential reuse, command injection, library hijacking — but chaining them together is the skill. Each escalation requires finding the right file, understanding what it does, and recognising the exploitable pattern.

The `getDreams.py` command injection is the most instructive part. The vulnerability isn't in MySQL or in sudo — it's in how the script processes data it reads from the database. Using `subprocess` with `shell=True` and unsanitised input is a textbook code vulnerability, and the fact that the input comes from a database rather than directly from the user makes it less obvious. The attacker doesn't need to compromise the script itself — they just need write access to the data it processes, and the script does the rest.

The Python library hijacking on the death-to-morpheus step is worth noting because it exploits a file permission issue that has nothing to do with the application logic. The system `shutil.py` being world-writable is a misconfiguration, and any script that imports `shutil` as a privileged user becomes an escalation vector. It's the kind of finding that automated scanners would flag as a low-priority file permission issue, but in context it's the key to the final flag.
