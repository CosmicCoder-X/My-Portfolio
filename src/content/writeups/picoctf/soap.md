---
title: 'SOAP'
target: 'picoCTF — SOAP'
difficulty: 'medium'
date: 2025-10-17
summary: 'A picoCTF Web Exploitation challenge — a Flask/Werkzeug web application that transmitted data via XML in POST requests to /data, where intercepting the request with Burp Suite revealed the XML structure <?xml version="1.0" encoding="UTF-8"?><data><ID>1</ID></data>, and since the server performed no defences against XXE (XML External Entity) attacks, injecting a DOCTYPE declaration with an external entity referencing the local filesystem — <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]> — and substituting &xxe; for the ID value caused the XML parser to resolve the entity by reading /etc/passwd and including its contents in the response, which revealed the full passwd file including the final entry picoctf:x:1001:picoCTF{XML_3xtern@l_3nt1t1ty_e5f02dbf} where the flag was embedded as the GECOS field of the picoctf user account.'
role: 'appsec'
tags: ['web-exploitation', 'xxe', 'xml', 'burp-suite', 'file-read', 'injection', 'flask', 'python', 'picoctf']
problem: 'SOAP is a picoCTF Web Exploitation challenge where the description states "The web project was rushed and no security assessment was done. Can you read the /etc/passwd file?" The challenge provides a web application URL and hints at XML External Entity Injection (XXE). The objective is to exploit the XML parser to read the server''s /etc/passwd file and extract the flag.'
action: 'Accessed the challenge URL which loaded a simple web page. To understand how the application communicated with the server, opened Burp Suite and intercepted the traffic. Clicking through the page triggered a POST request to /data with Content-Type application/xml. The request body contained a straightforward XML structure: <?xml version="1.0" encoding="UTF-8"?><data><ID>1</ID></data>. The XML format and the challenge hint pointing to XXE made the attack path clear. The challenge hint specifically mentioned "XML external entity Injection", which led to researching the technique on PortSwigger''s Web Security Academy. PortSwigger''s documentation on XXE explained the core concept: XML parsers support entity definitions in DOCTYPE declarations, and when an entity references an external resource using the SYSTEM keyword with a file:// URI, the parser reads that file and substitutes its contents wherever the entity is referenced in the document. The example payload from PortSwigger demonstrated the pattern: a DOCTYPE declaration defining an entity named xxe pointing to file:///etc/passwd, with the entity reference &xxe; placed inside the XML element where the parser would expand it. Adapted the PortSwigger payload to fit the application''s XML structure. The original request used <data><ID>1</ID></data>, so the XXE payload replaced the numeric ID value with the entity reference while adding the DOCTYPE declaration at the top. The crafted payload: <?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><data><ID>&xxe;</ID></data>. Sent the modified request from Burp Repeater. The server responded with HTTP 200 and the full contents of /etc/passwd rendered in the response body. The file contained standard Linux user accounts — root, daemon, bin, sys, games, man, lp, mail, news, uucp, proxy, www-data, backup, list, irc, gnats, nobody, _apt, flask (the application user running on /app with /bin/sh) — and at the very bottom, the flag: the picoctf user entry with UID 1001 whose GECOS/description field contained the flag picoCTF{XML_3xtern@l_3nt1t1ty_e5f02dbf}.'
outcome: 'Retrieved the flag picoCTF{XML_3xtern@l_3nt1t1ty_e5f02dbf} by exploiting an XXE vulnerability to read /etc/passwd from the server filesystem. The application used a Python/Flask backend (Werkzeug/2.3.6 Python/3.8.10) with an XML parser that had no XXE protections — it processed DOCTYPE declarations, resolved external entities, and included local file contents in its response without any restrictions. The fix is to disable external entity processing in the XML parser configuration — in Python''s lxml this means setting resolve_entities=False and no_network=True, or using defusedxml which disables all dangerous XML features by default. The challenge also demonstrated how flags can be hidden in unexpected places: rather than a standalone flag file, the flag was embedded in /etc/passwd as a user''s GECOS field, reinforcing the habit of reading the entire output rather than stopping at the first few lines.'
draft: false
---

## Background

SOAP is a picoCTF Web Exploitation challenge centred on XML External Entity Injection (XXE). The challenge description is direct: "The web project was rushed and no security assessment was done. Can you read the /etc/passwd file?" The hint confirms the attack vector — XXE. The application is a Flask/Werkzeug server that accepts XML-formatted data in POST requests and parses it without any protections against external entity resolution, making it a textbook XXE target.

---

## Intercepting the XML traffic

Opened the challenge URL in a browser through Burp Suite's proxy to inspect the traffic. Interacting with the page triggered a POST request to `/data` with `Content-Type: application/xml`. The request body contained a clean XML structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<data>
  <ID>
    1
  </ID>
</data>
```

![Burp Suite Proxy Intercept showing the POST /data HTTP/1.1 request to saturn.picoctf.net:60042 with the XML body containing a data element with an ID child element set to 1, Content-Type application/xml.](/writeups/picoctf-soap/01.png)

The application was using XML to transmit data between the browser and the server — the ID value likely corresponded to some record lookup. The XML format combined with the XXE hint made the attack path straightforward: if the server's XML parser processed DOCTYPE declarations and resolved external entities, injecting a `SYSTEM` entity pointing to a local file would cause the parser to read that file and include its contents in the response.

---

## Crafting the XXE payload

The challenge hint pointed to XML External Entity Injection, so I looked at PortSwigger's Web Security Academy for the standard XXE payload pattern. Their documentation showed the core technique: define an external entity in a DOCTYPE declaration using the `SYSTEM` keyword with a `file://` URI, then reference that entity anywhere in the XML document where the parser will expand it.

![PortSwigger Web Security Academy showing the XXE payload example: <?xml version="1.0" encoding="UTF-8"?> <!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]> with the entity reference &xxe; placed inside the productId element.](/writeups/picoctf-soap/02.png)

Adapted the PortSwigger payload to fit the application's XML structure. The original request used `<data><ID>1</ID></data>`, so the entity reference `&xxe;` replaced the numeric ID value. The crafted payload:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<data>
  <ID>
    &xxe;
  </ID>
</data>
```

The `<!DOCTYPE foo [...]>` declaration defines a document type with an inline DTD (Document Type Definition). Inside it, `<!ENTITY xxe SYSTEM "file:///etc/passwd">` declares an entity named `xxe` whose value is the contents of the local file `/etc/passwd`. When the XML parser encounters `&xxe;` in the document body, it resolves the entity by reading the file and substituting its contents — exactly like a variable expansion, except the "variable" is an entire file from the server's filesystem.

---

## Reading /etc/passwd and extracting the flag

Sent the modified request from Burp Suite's Repeater. The server responded with HTTP 200 and the entire contents of `/etc/passwd` rendered in the response body.

![Burp Suite Repeater showing the XXE payload in the request panel and the server response containing the full /etc/passwd file listing all user accounts from root through daemon, bin, sys, games, and others, ending with flask:x:999:999:/app:/bin/sh and picoctf:x:1001:picoCTF{XML_3xtern@l_3nt1t1ty_e5f02dbf} — the flag embedded as the GECOS field of the picoctf user, highlighted in blue in the Inspector panel.](/writeups/picoctf-soap/03.png)

The passwd file contained the standard Linux user accounts — root, daemon, bin, sys, games, man, lp, mail, news, uucp, proxy, www-data, backup, list, irc, gnats, nobody, _apt — plus the application's flask user (`flask:x:999:999:/app:/bin/sh`). The last entry was the flag, embedded as the GECOS field of a dedicated picoctf user:

```
picoctf:x:1001:picoCTF{XML_3xtern@l_3nt1t1ty_e5f02dbf}
```

`picoCTF{XML_3xtern@l_3nt1t1ty_e5f02dbf}`

---

## What I took from this

SOAP is one of the cleanest introductions to XXE I have come across. The vulnerability was completely unprotected — the server parsed the DOCTYPE declaration, resolved the external entity, read the local file, and reflected its contents in the response without any filtering or restriction. In real-world applications, XXE is often more constrained (out-of-band extraction, error-based techniques, or blind XXE through parameter entities), but this challenge demonstrated the core mechanism: XML parsers treat entity definitions as instructions to fetch data, and when user-controlled XML reaches a parser with external entity processing enabled, the attacker controls what files the server reads. The PortSwigger Web Security Academy was an excellent reference for understanding the technique — their XXE documentation walks through the progression from basic file reading through blind and out-of-band variants. The defence is straightforward: disable external entity and DTD processing in the XML parser. In Python, the `defusedxml` library is a drop-in replacement for the standard XML libraries that disables all dangerous features by default, making it the simplest fix for Flask applications like this one.
