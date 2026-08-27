---
title: 'CryptoCabana'
target: 'TryHackMe — CryptoCabana'
difficulty: 'medium'
date: 2026-08-27
summary: 'Exploiting implicit trust in Azure — from a hardcoded SAS token in client-side JavaScript through container enumeration, leaked service principal credentials, and Key Vault secret extraction including pre-rotation versions.'
role: 'appsec'
tags: ['Azure', 'Cloud security', 'SAS token', 'Key Vault', 'Service principal', 'OAuth2', 'Blob storage', 'Secret rotation']
problem: 'A crypto wallet backup kiosk hosted on Azure Static Websites. The app promises to store seed phrases safely, but the trust chain from client-side code to cloud storage to Key Vault is built on hardcoded credentials and overly broad permissions.'
action: 'Extracted a hardcoded SAS token from client-side JavaScript, enumerated all storage containers (including an unlisted vault), recovered Azure AD service principal credentials from a backup blob, authenticated via OAuth2 client credentials flow, and read Key Vault secrets — including pre-rotation versions that still held valid flag shards.'
outcome: 'Full privilege escalation from anonymous static-site visitor to Key Vault reader, all flag shards recovered including a rotated version that Key Vault retained by default.'
draft: false
---

CryptoCabana is a cloud-native room that doesn't touch a single Linux box. The
entire attack chain lives in Azure — from a static website to Blob Storage to
Azure AD to Key Vault — and the lesson is about how implicit trust between cloud
services creates privilege escalation paths that wouldn't exist if each
component enforced its own authentication boundary.

The target is a kiosk-style web app at
`https://cryptocabanaf5scjagc.z13.web.core.windows.net/` that claims to safely
back up crypto wallet seed phrases. The `*.web.core.windows.net` domain
immediately identifies it as an Azure Storage static website.

## Reading the client-side JavaScript

The landing page loads a single external script — `app.js`. Inspecting it
reveals hardcoded Azure Storage credentials:

![app.js source showing STORAGE_ACCOUNT, BACKUPS_CONTAINER, and BACKUP_SAS constants](/writeups/thm-cryptocabana/01-sas-token-source.png)

The SAS (Shared Access Signature) token is scoped with `sp=rl` (read + list)
and `srt=sco` (service + container + object level). This scope is the critical
finding: it isn't limited to the `backups` container. The `srt=sco` parameter
means the token is valid at the service level — it can enumerate *every*
container in the storage account, not just the one the app is designed to use.

Hardcoding a SAS token in client-side JavaScript is already a problem; making
it service-scoped rather than container-scoped turns a credential leak into a
full storage account enumeration.

## Enumerating storage containers

The Azure Blob Storage REST API supports listing all containers with a simple
GET request using the `?comp=list` parameter:

![Container list API request URL](/writeups/thm-cryptocabana/02-container-list-url.png)

```bash
cat app.js | grep -E "STORAGE_ACCOUNT|BACKUP_SAS"
```

```
const STORAGE_ACCOUNT = "cryptobacanaf5scjagc";
const BACKUP_SAS = "?sv=2022-11-02&ss=b&srt=sco&sp=rl&se=2099-12-31...&sig=...";
```

```bash
curl -s "https://cryptobacanaf5scjagc.blob.core.windows.net/?comp=list&$SAS"
```

```xml
<EnumerationResults ServiceEndpoint="https://cryptobacanaf5scjagc.blob.core.windows.net/">
  <Container><Name>$web</Name></Container>
  <Container><Name>backups</Name></Container>
  <Container><Name>vault</Name></Container>
</EnumerationResults>
```

![Grepping app.js for credentials and enumerating containers — vault container discovered](/writeups/thm-cryptocabana/03-grep-sas-containers.png)

Three containers come back: `$web` (the static site itself), `backups` (where
the kiosk writes user-submitted phrases), and `vault` — not referenced anywhere
on the site, not linked from any page, and clearly not intended for public
access.

## The hidden vault container

Listing the blobs in the `vault` container reveals two files: `seed_phrase.txt`
(a decoy) and `backup-service-account.json` — Azure AD service principal
credentials.

Reading the JSON:

![Service principal JSON with client_id, client_secret, tenant_id, key_vault_name and key_vault_uri](/writeups/thm-cryptocabana/04-service-principal-json.png)

This is a full Azure AD app registration: tenant ID, client ID, client secret,
and the Key Vault URI it's intended to access. The `note` field even says
"CryptoCabana backup automation account. Rotate this if it ever leaves the
vault." It left the vault.

The privilege escalation path is now clear: an anonymous visitor reads
client-side JavaScript, gets a SAS token, enumerates containers they shouldn't
see, finds a service principal with Key Vault access, and authenticates as that
identity.

## Authenticating to Azure AD

With the service principal credentials, an OAuth2 client credentials flow
against Azure AD produces a Bearer token scoped for `vault.azure.net`:

```bash
curl -s -X POST \
  "https://login.microsoftonline.com/$TENANT_ID/oauth2/v2.0/token" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET" \
  -d "scope=https://vault.azure.net/.default" \
  -d "grant_type=client_credentials"
```

This returns a Bearer access token. No MFA, no conditional access policy, no
IP restriction — the service principal authenticates with just the three values
from the JSON file.

## Key Vault secret enumeration

![curl command listing Key Vault secrets with the Bearer token](/writeups/thm-cryptocabana/05-vault-secrets-curl.png)

Listing all secrets in the Key Vault:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://ccabana-kv-f5scjagc.vault.azure.net/secrets?api-version=7.4"
```

Four secrets exist: `key-shard-1`, `key-shard-2`, `key-shard-3`, and
`master-key`. Inspecting the metadata reveals that `master-key` and
`key-shard-2` both have an "updated" timestamp later than their "created"
timestamp — a sign they've been rotated. The room drops a hint earlier: "if a
value looks freshly rotated, ask yourself what it looked like five minutes
before that."

## Reading the shards

`key-shard-1` and `key-shard-3` return their flag fragments directly from the
current version. For `key-shard-2`, the current version holds the post-rotation
value, but listing all versions of the secret reveals the original:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  ".../secrets/key-shard-2/versions?api-version=7.4"
```

Two versions come back with different creation timestamps. Reading the older
version ID returns the pre-rotation value — the original flag shard:

![Key Vault version enumeration and pre-rotation secret recovery](/writeups/thm-cryptocabana/06-key-shards-recovery.png)

All shards recovered. The flag was assembled from the three shard values.

The room also notes that the entire exercise can be performed using the Azure
CLI (`az storage`, `az login --service-principal`, `az keyvault secret`) instead
of raw `curl` commands — same results, less manual token handling.

![Azure CLI setup instructions from the room](/writeups/thm-cryptocabana/07-azure-cli-note.png)

## What I took from this

The attack chain here is entirely about implicit trust. The SAS token trusts
that the client will only access the `backups` container, but the scope says
otherwise. The `vault` container trusts that only authorised users will find it,
but obscurity isn't access control. The service principal credentials trust that
they'll stay inside the vault, but they're stored in a blob reachable by the
same over-scoped SAS token. And Key Vault trusts that rotating a secret
destroys the old value, but by default it retains every version indefinitely.

Each link in the chain makes a reasonable assumption in isolation, and the
exploitation is just following the trust further than anyone intended. The fix
at every stage is the same principle: don't assume the component before you in
the chain will enforce the boundary — enforce it yourself. Scope SAS tokens to
a single container. Don't store service principal credentials in reachable
storage. Apply conditional access policies to service principals. Purge or
disable old Key Vault versions after rotation, don't just supersede them.

The other lesson is that cloud misconfigurations don't require a shell, an
exploit, or even network access to a running service. This entire room is
HTTP requests to Azure APIs — no SSH, no reverse shell, no binary exploitation.
The attack surface is the configuration layer itself.
