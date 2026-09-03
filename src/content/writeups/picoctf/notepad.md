---
title: 'Notepad'
target: 'picoCTF — Notepad'
difficulty: 'hard'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge where a note-taking app used user input in the filename and rendered error templates with Jinja include, allowing path traversal via backslashes to plant a malicious template that achieved SSTI and full RCE through base64-encoded commands.'
role: 'appsec'
tags: ['web-exploitation', 'path-traversal', 'ssti', 'rce', 'jinja2', 'python', 'picoctf']
problem: "A note-taking site at notepad.mars.picoctf.net that writes user content to files in /static/ using the first 128 characters as the filename. Forward slashes and underscores are filtered, and the error page uses Jinja's include directive with user-controlled input."
action: "Discovered that backslashes bypassed the forward slash filter because url_fix() normalised them into slashes, used path traversal to write a file into the templates/errors/ directory, triggered it via the error query parameter to confirm template rendering, then crafted an SSTI payload with hex-escaped underscores and base64-encoded shell commands to achieve RCE."
outcome: 'Listed the application directory via RCE to find the flag file, then read its contents to retrieve the flag.'
draft: false
---

## Background

Notepad is a picoCTF Web Exploitation challenge that chains three vulnerabilities — path traversal, server-side template injection (SSTI), and remote code execution (RCE) — into a single exploit. The application is a minimal note-taking site: write some text, and it gets saved as a file in the `/static/` directory. The source code is provided as `notepad.tar`, which reveals the filtering logic, the filename construction, and the Jinja2 template rendering that makes the whole chain possible. The challenge description is simply "This note-taking site seems a bit off."

---

## The application and its filters

The application at `notepad.mars.picoctf.net` had a single feature: a text input labelled "make a new note" with a Submit button. Writing a note created an HTML file in the `/static/` directory and redirected the browser to it.

The source code revealed two important details about how notes were processed. First, the content was filtered:

```python
if "_" in content or "/" in content:
    return redirect(url_for("index", error="bad_content"))
```

Underscores and forward slashes were blocked — a clear sign that the developers were worried about path traversal and Python dunder attributes. Second, the filename was constructed from the note content itself:

```python
name = f"static/{url_fix(content[:128])}-{token_urlsafe(8)}.html"
with open(name, "w") as f:
    f.write(content)
```

The first 128 characters of the note became the filename path, followed by a random token and `.html`. The `url_fix()` function from Werkzeug was applied to this path — and critically, `url_fix()` normalises backslashes (`\`) into forward slashes (`/`). The developers blocked `/` in the content, but forgot about `\`. Since `url_fix()` converted backslashes after the filter check, backslashes could be used for path traversal.

---

## The error template include

The index page had a dynamic error display mechanism using Jinja2:

```
{% if error is not none %}
  <h3>error: {{ error }}</h3>
  {% include "errors/" + error + ".html" ignore missing %}
{% endif %}
```

Whatever value was passed in the `?error=` query parameter was concatenated into a Jinja `include` path under `templates/errors/`. If a file existed at that path, Jinja would render it as a template — meaning any Jinja syntax inside the file would be executed. This was the second piece of the chain: if a file could be planted in the `templates/errors/` directory, it could be triggered as a Jinja template through the error parameter.

---

## Path traversal to plant a template

The first test was whether backslash-based path traversal actually worked. Submitting a note with the content `..\templates\errors\` caused the application to write a file not into `/static/` as intended, but into the `templates/errors/` directory. The redirect went to a 404 page because the file was no longer under `/static/` where the web server expected it.

![Browser showing a 404 Not Found page at https://notepad.mars.picoctf.net/templates/errors/-bD2ci3G10EA.html with the message "The requested URL was not found on the server. If you entered the URL manually please check your spelling and try again."](/writeups/picoctf-notepad/01.png)

The 404 confirmed the path traversal — the file was written to `templates/errors/` instead of `static/`. The filename was `-bD2ci3G10EA.html` (the random token portion). To verify that the template was actually renderable, navigated to `https://notepad.mars.picoctf.net/?error=-bD2ci3G10EA` and the page displayed the error content along with the resolved path `..\templates\errors\`, confirming that the include directive was loading the planted file.

![Browser at https://notepad.mars.picoctf.net/?error=-bD2ci3G10EA showing "error: -bD2ci3G10EA" as a heading, the resolved path "..\templates\errors\" below it, and the "make a new note" form at the bottom.](/writeups/picoctf-notepad/02.png)

---

## Server-side template injection

With the ability to plant and render arbitrary templates, the next step was SSTI. But there was a constraint: the first 128 characters of the note content were consumed by the filename path. The SSTI payload had to start after the 128-character mark so it would appear in the file content but not in the filename. The path traversal prefix (the chain of `..\` segments) was padded to exactly fill those 128 characters.

The filename construction also had a 512-character total limit on note content, so the payload had to fit between positions 128 and 512. A test payload with `{{7*7}}` after the traversal padding confirmed that Jinja was evaluating expressions — the rendered output showed `te49` instead of `te{{7*7}}`, proving that `7*7` had been calculated to `49` inside the template.

![Browser at https://notepad.mars.picoctf.net/?error=te-iiFquHMs5k8 showing "error: te-iiFquHMs5k8" and the resolved path ending in "\app\templates\errors\te49", where the Jinja expression {{7*7}} has been evaluated to 49 in the rendered output.](/writeups/picoctf-notepad/03.png)

---

## Remote code execution

SSTI in Jinja2 can be escalated to full RCE by traversing Python's object hierarchy to reach the `os` module. The standard approach uses `__globals__`, `__builtins__`, and `__import__` — but underscores were filtered. The workaround was hex escaping: `__globals__` became `\x5f\x5fglobals\x5f\x5f`, which Jinja2 interpreted correctly while bypassing the underscore filter entirely.

The full RCE payload used `request.application` as the entry point into the Python object graph, navigated through `__globals__` and `__builtins__` to reach `__import__`, imported the `os` module, and called `popen()` to execute a shell command. The command itself was base64-encoded to avoid issues with spaces, slashes, and other characters that might conflict with the URL encoding or the content filters:

```
{% with a = request["application"]["\x5f\x5fglobals\x5f\x5f"]["\x5f\x5fbuiltins\x5f\x5f"]["\x5f\x5fimport\x5f\x5f"]("os")["popen"]("echo -n bHMgL2FwcA== | base64 -d | bash")["read"]() %}{{a}}{% endwith %}
```

The base64 string `bHMgL2FwcA==` decoded to `ls /app`. Submitting this payload through the path traversal chain and triggering it via the error parameter listed the contents of the `/app` directory. The output revealed the application files and, crucially, the flag file: `flag-c8f5526c-4122-4578-96de-d7dd27193798.txt`.

![Browser at https://notepad.mars.picoctf.net/?error=te-g_cQeq7hJTA showing the resolved path ending in "\app\templates\errors\teapp.py flag-c8f5526c-4122-4578-96de-d7dd27193798.txt static templates", which is the output of ls /app rendered through the SSTI payload.](/writeups/picoctf-notepad/04.png)

Replaced `ls /app` with `cat /app/flag-c8f5526c-4122-4578-96de-d7dd27193798.txt` (base64-encoded as the new command), submitted the payload again, and the flag appeared in the rendered template output.

![Browser at https://notepad.mars.picoctf.net/?error=te-bR8iDKGeNdA showing the resolved path ending in "\app\templates\errors\tepicoCTF{styl1ng_susp1c10usly_s1m1l4r_t0_p4steb1n}", which is the flag rendered through the SSTI-to-RCE payload.](/writeups/picoctf-notepad/05.png)

`picoCTF{styl1ng_susp1c10usly_s1m1l4r_t0_p4steb1n}`

---

## What I took from this

This challenge is a textbook example of how multiple individually minor vulnerabilities can chain into full system compromise. The path traversal alone would only let an attacker write files to unintended directories — annoying but not immediately exploitable. The Jinja include on user input alone would be harmless if no attacker-controlled templates existed. The SSTI would be impossible without a way to plant a template. And the RCE payload would never execute without SSTI. Each vulnerability enabled the next one in the chain. The filter bypass was also instructive: blocking `/` but not `\` is a common mistake because developers think about Unix path separators and forget that many libraries (including Werkzeug's `url_fix()`) normalise backslashes. The underscore filter was similarly incomplete — hex escapes in Jinja2 strings are evaluated before the template is processed, so `\x5f` bypasses any text-level filter on `_`. The broader lesson is that input filtering is a fundamentally fragile defence strategy. Each filter needs to account for every encoding, normalisation, and transformation that the input passes through between the filter and its final use — and missing even one bypass renders the filter useless. Parameterised queries, allowlists, sandboxed template environments, and principle of least privilege (not running the web app with filesystem write access outside its data directory) are all more robust alternatives.
