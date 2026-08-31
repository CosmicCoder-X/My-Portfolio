---
title: 'More SQLi'
target: 'picoCTF — More SQLi'
difficulty: 'medium'
date: 2026-07-22
summary: 'A picoCTF Web Exploitation challenge — a login-protected web application backed by SQLite where the login form was bypassed with the classic credential admin/admin, revealing a "Search Office" feature that displayed a table of cities with addresses and phone numbers, and the Kampala row''s address field contained the hint "Maybe all the tables" suggesting further enumeration was needed. Injecting '' OR 1=1 -- into the search field returned all rows confirming SQL injection, then UNION SELECT payloads were used to enumerate the database: '' UNION SELECT 1, name, 3 FROM sqlite_master WHERE type=''table'' -- revealed four tables (hints, more_table, offices, users), '' UNION SELECT 1, sql, 3 FROM sqlite_master WHERE name=''more_table'' -- dumped the schema showing CREATE TABLE more_table (id INTEGER NOT NULL PRIMARY KEY, flag TEXT), and '' UNION SELECT 1, *, 3 FROM more_table -- extracted the flag picoCTF{G3tting_5QL_1nJ3c7I0N_l1k3_y0u_sh0ulD_98236ce6} from the first row alongside a second row containing a decoy message.'
role: 'appsec'
tags: ['web-exploitation', 'sql-injection', 'sqlite', 'union-sqli', 'authentication-bypass', 'database-enumeration', 'picoctf']
problem: 'More SQLi is a picoCTF Web Exploitation challenge presenting a web application with a login page and a city office directory backed by a SQLite database. The objective is to find and exploit SQL injection vulnerabilities to enumerate the database tables, discover a hidden table containing the flag, and extract it.'
action: 'Accessed the challenge URL which presented a login page. Entered the credentials admin/admin and gained access to the main application — a Welcome page with a Log Out button and a "Search Office" feature. The search interface consisted of a text input labelled "City" with a Search button, and below it a table displaying office locations with three columns: City, Address, and Phone. The table listed eight cities — Algiers, Bamako, Nairobi, Kampala, Kigali, Kinshasa, Lagos, and Pretoria — each with a street address and phone number. The Kampala row stood out: its Address field read "Maybe all the tables" instead of a real address, which was a direct hint that the challenge required enumerating beyond the visible offices table. Tested the search field for SQL injection by entering '' OR 1=1 -- which returned all rows, confirming the input was being concatenated directly into a SQL query without parameterisation. With injection confirmed, moved to UNION-based extraction. The visible table had three columns (City, Address, Phone), so UNION payloads needed three columns to match. Enumerated the database tables using sqlite_master: '' UNION SELECT 1, name, 3 FROM sqlite_master WHERE type=''table'' --. The results replaced the office data with a list of four table names in the Address column: hints, more_table, offices, and users. The more_table name was the obvious target given the Kampala hint. Extracted the schema of more_table: '' UNION SELECT 1, sql, 3 FROM sqlite_master WHERE name=''more_table'' --. The response displayed the CREATE TABLE statement: CREATE TABLE more_table (id INTEGER NOT NULL PRIMARY KEY, flag TEXT) — a two-column table with an integer primary key and a text column explicitly named flag. Dumped the contents of more_table: '' UNION SELECT 1, *, 3 FROM more_table --. The query returned two rows: the first contained the flag picoCTF{G3tting_5QL_1nJ3c7I0N_l1k3_y0u_sh0ulD_98236ce6}, and the second contained a decoy message starting with "If you are here, you must have s..." (truncated in the display).'
outcome: 'Retrieved the flag picoCTF{G3tting_5QL_1nJ3c7I0N_l1k3_y0u_sh0ulD_98236ce6} through UNION-based SQL injection against a SQLite database. The application had no input sanitisation on the search parameter — user input was concatenated directly into the SQL query string, allowing full control over the query structure. The UNION technique exploited the fact that the original SELECT returned three columns, so injecting UNION SELECT with matching column counts appended attacker-controlled rows to the result set, enabling enumeration of sqlite_master for table names and schemas, and direct extraction of data from any table in the database. The correct mitigations are parameterised queries (using placeholders like ? in SQLite) that separate SQL logic from user data, input validation that rejects special characters not expected in a city name search, and the principle of least privilege — the database user should not have access to tables beyond what the application needs to display.'
draft: false
---

## Background

More SQLi is a picoCTF Web Exploitation challenge centred on classic SQL injection against a SQLite-backed web application. The application presents a login page and a searchable directory of office locations. The challenge is a progression through increasingly useful injection payloads — from confirming the vulnerability with a tautology, through database enumeration via `sqlite_master`, to extracting the flag from a hidden table. The Kampala row's address field literally reads "Maybe all the tables", pointing directly at the enumeration path.

---

## Logging in and exploring the application

The challenge URL loaded a login page. Entering the credentials `admin` / `admin` granted access to the main application — a Welcome page with a Log Out button and a "Search Office" feature. The search interface had a text input labelled "City" with a Search button, and below it a table displaying office locations across three columns: City, Address, and Phone.

![Welcome page after logging in with admin/admin, showing a Log Out button, the Search Office heading with a City search input and Search button, and a table listing eight office locations — Algiers, Bamako, Nairobi, Kampala (with address "Maybe all the tables"), Kigali, Kinshasa, Lagos, and Pretoria — each with street addresses and phone numbers.](/writeups/picoctf-more-sqli/01.png)

Eight cities were listed: Algiers, Bamako, Nairobi, Kampala, Kigali, Kinshasa, Lagos, and Pretoria. Each had a street address and phone number — except Kampala, whose Address field read "Maybe all the tables" instead of a real address. That was the challenge's built-in hint: the flag was not in the offices table, and the path to it required enumerating the other tables in the database.

---

## Confirming SQL injection and enumerating tables

Tested the search field with the classic tautology payload `' OR 1=1 --` which returned all rows in the table, confirming that user input was being concatenated directly into the SQL query without parameterisation or escaping. With injection confirmed and the three-column output structure visible (City, Address, Phone), UNION-based extraction was the natural next step — matching the column count with `UNION SELECT 1, <target>, 3` to slot the extracted data into the Address column.

The first extraction targeted the database schema. SQLite stores table metadata in `sqlite_master`, a system table with columns for type, name, tbl_name, rootpage, and sql. Enumerating all table names:

```
' UNION SELECT 1, name, 3 FROM sqlite_master WHERE type='table' --
```

![Search results showing the UNION SELECT output with four table names in the Address column: hints, more_table, offices, and users — the complete list of tables in the SQLite database.](/writeups/picoctf-more-sqli/02.png)

The query returned four tables: `hints`, `more_table`, `offices`, and `users`. The `offices` table was the one powering the visible search feature. The `more_table` name was the clear target — especially given the Kampala hint about "all the tables".

---

## Extracting the schema and the flag

Before dumping `more_table`, extracted its schema to understand the column structure:

```
' UNION SELECT 1, sql, 3 FROM sqlite_master WHERE name='more_table' --
```

![Search results showing the CREATE TABLE statement for more_table in the Address column: CREATE TABLE more_table (id INTEGER NOT NULL PRIMARY KEY, flag TEXT) — a two-column table with an integer id and a text column named flag.](/writeups/picoctf-more-sqli/03.png)

The schema revealed a simple two-column table: `id INTEGER NOT NULL PRIMARY KEY` and `flag TEXT`. The column was literally named `flag` — no ambiguity about what it held. With the schema known, extracting the contents was a single query:

```
' UNION SELECT 1, *, 3 FROM more_table --
```

![Search results showing two rows from more_table: the first row with id 1 and the flag value picoCTF{G3tting_5QL_1nJ3c7I0N_l1k3_y0u_sh0ulD... (truncated in the display), and a second row with id 2 containing a decoy message "If you are here, you must have s..." also truncated.](/writeups/picoctf-more-sqli/04.png)

The query returned two rows. The first contained the flag, and the second held a decoy message that started with "If you are here, you must have s..." — a red herring for anyone who stopped at the wrong row. The flag was visible in the Phone column where the `UNION SELECT` mapped `more_table`'s columns into the three-column output.

`picoCTF{G3tting_5QL_1nJ3c7I0N_l1k3_y0u_sh0ulD_98236ce6}`

---

## What I took from this

More SQLi is a well-structured introduction to UNION-based SQL injection. The challenge walked through the entire methodology: confirm injection with a tautology, determine the column count from the visible output, enumerate the database schema through `sqlite_master`, extract table definitions to understand the target structure, and finally dump the data. The Kampala hint ("Maybe all the tables") was a clever in-application nudge that mimicked the kind of anomalous data an attacker might notice during reconnaissance — something that does not belong in the expected dataset and suggests there is more to find. The `sqlite_master` enumeration technique is specific to SQLite; other databases use different metadata tables (`information_schema` in MySQL/PostgreSQL, `sysobjects` in SQL Server), but the principle is the same: every relational database exposes its own schema through queryable system tables, and once an attacker has UNION injection, the entire database structure is transparent. The defence is straightforward — parameterised queries (prepared statements) that treat user input as data rather than SQL syntax. In SQLite, this means using `?` placeholders in the query and passing user input as bound parameters, which makes injection structurally impossible regardless of what characters the input contains.
