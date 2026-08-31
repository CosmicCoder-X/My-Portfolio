---
title: '3v@l'
target: 'picoCTF — 3v@l'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge — a Bank-Loan Calculator web application at shape-facility.picoctf.net:55838 that used Python''s eval() function to evaluate user-supplied mathematical formulas, where the server applied regex-based filtering to block common injection keywords (cat, .txt, and others) and certain characters, but by leveraging Python''s dynamic class creation via type() to construct a lambda that called open().read() on the flag file path — with the blocked string /flag.txt encoded as hex bytes using bytes.fromhex(''2f666c61672e747874'').decode(''utf-8'') to bypass the .txt filter — the final payload type(''dynamicClass'',(object,),{''method'':lambda self:open((bytes.fromhex(''2f666c61672e747874'').decode(''utf-8''))).read()})().method() was evaluated by eval() and returned the flag file contents directly as the calculator result.'
role: 'appsec'
tags: ['web-exploitation', 'python', 'eval-injection', 'code-injection', 'filter-bypass', 'hex-encoding', 'dynamic-class', 'picoctf']
problem: '3v@l is a picoCTF Web Exploitation challenge presenting a Bank-Loan Calculator that uses Python''s eval() function to evaluate user-supplied formulas. The challenge description makes the eval() usage clear, pointing directly at code injection as the attack vector. However, the application applies regex-based input filtering that blocks common shell commands (cat), file extensions (.txt), and other keywords typically used in injection payloads, requiring creative use of Python''s built-in features to bypass the restrictions and read the flag file.'
action: 'Accessed the challenge at http://shape-facility.picoctf.net:55838 which presented a clean Bank-Loan Calculator interface with a textarea labelled "Enter the formula:" showing the placeholder example PRT*RATE*TIME(10000*23*12), an Execute button, and a Go back link. The placeholder suggested the application expected mathematical expressions, but since the description confirmed eval() was being used, any valid Python expression would be evaluated — not just arithmetic. Started testing the boundaries of what the application would accept. Direct shell command attempts and common injection patterns failed — the server was running the input through regex-based filtering before passing it to eval(). Through trial and error, identified that keywords like cat and file extensions like .txt were blacklisted, along with other characters and constructs commonly found in injection payloads. An important observation came from testing print(1) — the result page showed "Result: None" rather than "1". This revealed how the application worked: it displayed the return value of whatever expression eval() evaluated, not the stdout output. Since print() always returns None in Python regardless of what it outputs, the result page showed None. This meant the payload needed to be an expression that returned the flag file contents as its value, not one that printed them to stdout. The challenge was constructing a Python expression that opened and read /flag.txt without using any blacklisted strings or characters. The solution used Python''s dynamic class creation through the type() built-in function. In Python, type() with three arguments creates a new class at runtime — the first argument is the class name, the second is a tuple of base classes, and the third is a dictionary of attributes. By defining a class with a lambda method that reads a file, the expression could be self-contained: type("dynamicClass", (object,), {"method": lambda self: open("/flag.txt").read()})().method(). The type() call creates the class, the trailing () instantiates it, and .method() calls the lambda which opens and reads the file — and since the lambda returns the file contents, eval() captures that return value and the application displays it as the result. But /flag.txt contained the blocked substring .txt, so the path string itself needed encoding. Python''s bytes.fromhex() provided the bypass — converting /flag.txt to its hexadecimal representation 2f666c61672e747874 and decoding it back at runtime: bytes.fromhex("2f666c61672e747874").decode("utf-8"). The regex filter never sees .txt in the input text because it only exists as hex digits until Python processes the expression. The final payload combining both techniques: type("dynamicClass",(object,),{"method":lambda self:open((bytes.fromhex("2f666c61672e747874").decode("utf-8"))).read()})().method(). Submitted this through the calculator and the result page displayed the flag file contents.'
outcome: 'Retrieved the flag by exploiting the eval() function through Python dynamic class creation and hex-encoded string bypass. The challenge demonstrated two important concepts: first, that eval() is fundamentally unsafe for processing user input regardless of how much filtering is applied, because Python''s expressiveness means there are always alternative ways to construct the same operations — type() for class creation, bytes.fromhex() for string encoding, lambda for inline function definitions, all of which are core language features that cannot be blacklisted without breaking legitimate functionality. Second, that understanding how an application handles return values versus stdout output is critical for crafting effective payloads — a payload that prints the flag to stdout would have succeeded in execution but shown "None" on the result page, making it appear to have failed. The correct mitigation is replacing eval() with a restricted expression parser that only handles arithmetic operations, or using ast.literal_eval() which safely evaluates only Python literal structures.'
draft: false
---

## Background

3v@l is a picoCTF Web Exploitation challenge built around one of the most dangerous functions in Python — `eval()`. The application is a Bank-Loan Calculator that takes mathematical formulas from the user and evaluates them server-side. The challenge description is upfront about the `eval()` usage, so the vulnerability is known from the start. The real challenge is in the bypass: the application runs input through regex filtering that blocks common injection patterns, requiring creative use of Python's built-in capabilities to construct a payload that reads the flag file without triggering any filter rules.

---

## The calculator interface

The challenge loaded at `http://shape-facility.picoctf.net:55838` with a straightforward interface: a page titled "Bank-Loan Calculator" with a textarea asking "Enter the formula:", a placeholder showing `example: PRT*RATE*TIME(10000*23*12)`, a blue Execute button, and a Go back link.

![Bank-Loan Calculator web interface at shape-facility.picoctf.net:55838 showing a textarea with placeholder text "example: PRT*RATE*TIME(10000*23*12)", a blue Execute button, and a Go back link.](/writeups/picoctf-3val/01.png)

The placeholder suggested arithmetic expressions, but with `eval()` under the hood, anything that constitutes a valid Python expression is fair game — function calls, object instantiation, attribute access, the works. The question was which constructs the filter would allow through.

---

## Probing the filter

Started testing inputs to map the restrictions. Direct attempts at common injection patterns — calling `os.system()`, using `cat`, referencing `.txt` files — all came back with "Forbidden" errors. The server was clearly running the input through regex-based filtering before it ever reached `eval()`. Through trial and error, the blacklist included at least `cat`, `.txt`, and several other keywords and characters commonly used in Python code injection payloads.

One test revealed something important about how the application handled results. Submitting `print(1)` returned "Result: None" on the response page. In Python, `print()` writes to stdout but always returns `None` — and the application was displaying the return value of the evaluated expression, not capturing stdout. This meant the payload had to be an expression whose return value was the flag file contents. A payload that successfully executed `os.system("cat /flag.txt")` would have printed the flag to the server's stdout (invisible to us) and shown "Result: 0" (the exit code) on the page — useless. The payload needed to return the data directly as a Python object.

---

## Building the payload

The approach was to construct a self-contained Python expression that opened `/flag.txt`, read its contents, and returned them — all within the constraints of what `eval()` accepts (expressions only, no statements) and what the filter allowed through.

Python's `type()` function solved the expression constraint. When called with three arguments — a class name, a tuple of base classes, and a dictionary of attributes — `type()` dynamically creates a new class at runtime. By defining a method as a `lambda` that reads a file, the entire operation becomes a single expression:

```python
type("dynamicClass", (object,), {"method": lambda self: open("/flag.txt").read()})().method()
```

This creates a class with a `method` attribute that opens and reads a file, instantiates the class with `()`, and calls `.method()` which returns the file contents. Since `eval()` returns whatever the expression evaluates to, the result page would display the file contents directly.

But the string `/flag.txt` contained `.txt`, which the filter blocked. The bypass used Python's `bytes.fromhex()` to construct the string at runtime from its hexadecimal representation. The path `/flag.txt` in hex is `2f666c61672e747874`. Decoding it back to a string at evaluation time:

```python
bytes.fromhex("2f666c61672e747874").decode("utf-8")
```

The filter sees only hex digits and function names — no `.txt` anywhere in the raw input. But once Python evaluates the expression, the hex bytes decode into the exact string `/flag.txt`.

Combining both techniques into the final payload:

```python
type("dynamicClass",(object,),{"method":lambda self:open((bytes.fromhex("2f666c61672e747874").decode("utf-8"))).read()})().method()
```

---

## Capturing the flag

Pasted the payload into the formula textarea and hit Execute. The result page rendered the flag file contents directly as the calculator's result.

![Bank-Loan Calculator result page showing "Result:" followed by the flag picoCTF{...3bc5aa53} — the contents of /flag.txt returned by the dynamic class payload evaluated through eval().](/writeups/picoctf-3val/02.png)

The flag was retrieved successfully — the dynamic class lambda read `/flag.txt` and returned its contents, which `eval()` passed straight through to the result page.

---

## What I took from this

The 3v@l challenge is a clean illustration of why `eval()` should never process user input, period. The application had regex filtering that blocked obvious attack strings, but Python is an extraordinarily expressive language — `type()` for dynamic class creation, `lambda` for inline functions, `bytes.fromhex()` for string construction, `open().read()` for file access — all of these are core language features that exist in any Python environment and cannot be blacklisted without breaking the language itself. Every restriction the filter imposed had a clean workaround using nothing but built-in Python. The return value observation was equally important: understanding that `eval()` returns expression results rather than capturing stdout was the difference between a payload that appeared to fail (showing "None") and one that displayed the flag directly. The correct fix is never using `eval()` on user input — for a calculator, `ast.literal_eval()` safely handles numeric literals, or a purpose-built expression parser can evaluate arithmetic without exposing the full Python runtime.
