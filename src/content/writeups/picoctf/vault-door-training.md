---
title: 'Vault Door Training'
target: 'picoCTF — Vault Door Training'
difficulty: 'easy'
date: 2026-07-22
summary: 'A picoCTF Reverse Engineering challenge where the provided Java source code contained the vault password as a hardcoded string comparison inside the checkPassword method, making the flag readable directly from the source.'
role: 'appsec'
tags: ['reverse-engineering', 'java', 'source-code-analysis', 'picoctf']
problem: 'A vault door program written in Java that prompts for a password. The source code is provided and the password check is a direct string comparison against a hardcoded value.'
action: 'Read the provided VaultDoorTraining.java source, traced the input handling from the Scanner through the substring call that strips the picoCTF{ prefix, and found the plaintext password in the checkPassword method.'
outcome: 'Retrieved the flag by reading the hardcoded password string directly from the source code.'
draft: false
---

## Background

Vault Door Training is the first in a series of picoCTF Reverse Engineering challenges themed around breaking into Dr. Evil's laboratory. The challenge description sets the scene: enter the lab, retrieve blueprints for the Doomsday Project, and unlock vault doors by figuring out their passwords. The source code for the vault's computer is provided — a Java file called `VaultDoorTraining.java`. As the "training" name suggests, this is the introductory level, and the password is stored in the most straightforward way possible.

---

## Reading the source code

The provided Java source was a single class with a `main` method that prompted for a password and a `checkPassword` method that validated it. The `main` method read user input via a `Scanner`, then stripped the `picoCTF{` prefix and the closing `}` from the input using `substring` before passing the remaining string to `checkPassword`:

```java
String userInput = scanner.next();
String input = userInput.substring("picoCTF{".length(), userInput.length()-1);
if (vaultDoor.checkPassword(input)) {
    System.out.println("Access granted.");
} else {
    System.out.println("Access denied!");
}
```

The `substring` call starting at position 8 (the length of `picoCTF{`) and ending one character before the end (dropping the `}`) meant the program expected the full flag format as input, but only compared the inner portion against the stored password.

The `checkPassword` method itself was a single line — a direct string comparison against a hardcoded value:

```java
public boolean checkPassword(String password) {
    return password.equals("w4rm1ng_Up_w1tH_jAv4_3808d338b46");
}
```

A comment above the method from "Minion #9567" even acknowledged the problem: "Is it safe to put the password in the source code? What if somebody stole our source code? Then they would know what our password is."

The password was `w4rm1ng_Up_w1tH_jAv4_3808d338b46`, and wrapping it back in the flag format gave the complete flag.

`picoCTF{w4rm1ng_Up_w1tH_jAv4_3808d338b46}`

---

## What I took from this

This challenge is intentionally trivial — it is the training level for the Vault Door series — but the lesson it introduces is fundamental: hardcoded credentials in source code are not a security mechanism. The minion's comment captures the exact problem. Source code is not secret: it gets committed to repositories, shared between teams, decompiled from binaries, and leaked in breaches. Any password, API key, or secret stored directly in source code should be treated as already compromised. In real applications, secrets belong in environment variables, dedicated secret management systems (like HashiCorp Vault, AWS Secrets Manager, or similar), or encrypted configuration files — anywhere that separates the secret from the code that uses it. The subsequent Vault Door challenges in the series progressively demonstrate more sophisticated (but still ultimately reversible) ways of obscuring the password, reinforcing that obscurity is not security.
