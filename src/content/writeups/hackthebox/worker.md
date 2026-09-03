---
title: 'Worker'
target: 'Hack The Box — Worker'
difficulty: 'medium'
date: 2026-01-10
summary: "SVN commit history leaks credentials for Azure DevOps portal — CI pipeline abuse deploys an ASPX webshell via pull request merge, SVN config files expose a second user's credentials for evil-winrm access, and pipeline creation permissions in a second project yield an elevated shell through the build agent."
role: 'pentest'
tags: ['nmap', 'iis', 'svn', 'subversion', 'version-control', 'credential-disclosure', 'azure-devops', 'ci-cd', 'pipeline', 'aspx', 'webshell', 'pull-request', 'evil-winrm', 'powershell', 'reverse-shell', 'privilege-escalation', 'windows']
problem: "Medium Windows box with IIS (80), SVN (3690), and WinRM (5985). SVN history leaks developer credentials and points to an Azure DevOps instance. CI pipeline auto-deploys merged code to IIS subdomains, and SVN config files on disk expose a second user with pipeline creation permissions in another project."
action: "Nmap found IIS (80), SVN (3690), and WinRM (5985). Checked out the SVN repo — svn diff revealed nathen:wendel98 in a deleted deploy.ps1 and a pointer to devops.worker.htb. Logged into Azure DevOps as nathen — found SmartHotel360 project with an Alpha-CI pipeline deploying merged code to IIS subdomains. Created an ASPX webshell in the alpha repo via web editor, committed to a new branch, approved the PR, and the pipeline deployed it to alpha.worker.htb. Reverse shell as iis apppool\\defaultapppool. Found W:\\svnrepos\\www\\conf\\passwd with robisl:wolves11. Evil-winrm as robisl for user flag. Logged into DevOps as robisl — created a new pipeline in the PartsUnlimited project with an inline PowerShell reverse shell. Pipeline agent delivered an elevated shell for root."
outcome: "Rooted via SVN credential disclosure, CI/CD pipeline abuse for webshell deployment, plaintext credential extraction from SVN config files, and pipeline creation permissions for elevated code execution through the build agent."
draft: false
---

## Background

Worker is a medium-rated Windows machine that turns a CI/CD pipeline into an attack surface. The entry point is a Subversion repository that leaks developer credentials in its commit history — a common oversight when secrets are "deleted" from version control without understanding that every prior revision is permanent. Those credentials unlock an Azure DevOps portal where the real attack unfolds: a CI pipeline automatically deploys whatever gets merged into the master branch of any repository, and the pull request workflow is the only gate. With commit access, that gate is trivially bypassed to deploy a webshell to a live IIS site. The privilege escalation follows the same pattern but at a higher level — a second user's credentials found in SVN configuration files grant access to create entirely new pipelines, and a pipeline's build agent executes code with elevated privileges. The entire chain exploits trust in the development workflow rather than any software vulnerability.

---

## Enumeration

Running an **nmap** scan with service version detection:

```
nmap -vv --reason --top-ports 1000 -sV -Pn 10.10.10.203
```

```
PORT     STATE SERVICE  REASON  VERSION
80/tcp   open  http     syn-ack Microsoft IIS httpd 10.0
3690/tcp open  svnserve syn-ack Subversion
5985/tcp open  http     syn-ack Microsoft HTTPAPI httpd 2.0 (SSDP/UPnP)
```

Three ports — a lean attack surface compared to most Windows machines. **IIS 10.0** on port 80 serves a default landing page, but the page source references `worker.htb`. **Subversion** on port 3690 is immediately interesting — version control repositories often contain more than their current state suggests. **WinRM** on 5985 means remote management is available if valid credentials turn up.

Browsing port 80 shows nothing actionable, so the SVN repository is the natural starting point. Checking it out:

```
svn checkout svn://worker.htb
```

The repository pulls down cleanly. Running `svn log` reveals five revisions, all committed by **nathen**. The interesting content is in the diffs between revisions — specifically, what was added and then removed:

```
svn diff -r 1:2
```

Revision 2 introduced a `deploy.ps1` script containing hardcoded credentials:

```powershell
$user = "nathen"
$plain = "wendel98"
```

The script was later deleted, but SVN preserves every revision permanently. Deleting a file from version control removes it from the working copy, not from history. A further diff between revisions 4 and 5 reveals a `moved.txt` file pointing to `http://devops.worker.htb` as the new home for the project. Two valuable discoveries from one repository — credentials and a new hostname.

---

## Azure DevOps — mapping the CI/CD pipeline

Adding `devops.worker.htb` to `/etc/hosts` and browsing to it presents an HTTP authentication prompt. The credentials `nathen:wendel98` from the SVN history work, landing on an Azure DevOps portal under the **ekenas** collection:

![Azure DevOps portal at devops.worker.htb/ekenas showing the ekenas collection. Projects tab is selected with a single project visible — SmartHotel360 with the description "Our vision - The smartest hotel @ 2020". Left sidebar shows Collections with ekenas selected. Related pages section shows Documentation and Get help links. Collection Settings visible at bottom left.](/writeups/htb-worker/01-devops-portal.png)

A single project — **SmartHotel360**. Navigating into the Repos section reveals something interesting: the project contains not one but nine separate repositories:

![Azure DevOps Repos view for SmartHotel360 showing the spectral repository with a dropdown listing all nine repositories — alpha, cartoon, dimension, lens, SmartHotel360, solid-state, spectral, story, and twenty. The spectral repo file tree shows assets and images folders, elements.html, generic.html, index.html, LICENSE.txt, and README.txt. Branch set to master.](/writeups/htb-worker/02-repos-list.png)

Nine repositories, each containing what looks like an HTML5 website template — **alpha**, **cartoon**, **dimension**, **lens**, **solid-state**, **spectral**, **story**, and **twenty**, plus the main SmartHotel360 repo. The naming convention and the file structures (assets, images, index.html) suggest each repo powers a different subdomain. The Pipelines section confirms this theory:

![Azure DevOps Pipelines view showing the Alpha-CI pipeline configuration under Sites. Tasks tab displays the pipeline structure — Pipeline with Get sources pulling from the alpha repo on master branch, Agent job 1, and a Deploy web site task using Copy files. Right panel shows the Copy files task details: Source Folder $(Build.SourcesDirectory), Contents !.git"/*", and Target Folder w:\sites\$(Build.Repository.Name).worker.htb highlighted in yellow.](/writeups/htb-worker/03-pipeline-config.png)

The **Alpha-CI** pipeline tells the full story. The Copy files task deploys from `$(Build.SourcesDirectory)` to `w:\sites\$(Build.Repository.Name).worker.htb`. That variable substitution means any file merged into the alpha repository's master branch gets copied to `w:\sites\alpha.worker.htb` — and IIS is configured to serve that directory. Adding `alpha.worker.htb` to `/etc/hosts` and browsing to it confirms the deployment is live:

![Browser at alpha.worker.htb showing the Alpha HTML5 UP template page with "Introducing the ultimate mobile app for doing stuff with your phone" heading. Firefox DevTools Network tab is open showing response headers — Server: Microsoft-IIS/10.0 and X-Powered-By: ASP.NET are visible, with X-Powered-By highlighted in yellow. Host header confirms alpha.worker.htb.](/writeups/htb-worker/04-alpha-aspnet.png)

**ASP.NET** is enabled on IIS — the `X-Powered-By: ASP.NET` header confirms it. This means the server will execute `.aspx` files, not just serve static HTML. The attack path is clear: commit an ASPX webshell to the alpha repository, get it merged to master, let the CI pipeline deploy it, and access it at `alpha.worker.htb/cmd.aspx`.

---

## Webshell deployment through the PR workflow

Azure DevOps doesn't allow direct commits to master — changes must go through a branch and pull request. Creating a new file `cmd.aspx` in the alpha repository through the web editor:

![Azure DevOps file editor showing the alpha repository with a new file cmd.aspx. The code is a 39-line ASP.NET webshell written in C# — Page_Load is empty, ExcuteCmd function uses ProcessStartInfo with cmd.exe /c to execute commands, StreamReader captures stdout. The HTML section contains a form with a textbox, an execute button bound to cmdExe_Click, and a Command label. Title reads "awen asp.net webshell".](/writeups/htb-worker/05-webshell-code.png)

The webshell is straightforward C# — `ProcessStartInfo` launches `cmd.exe /c` with whatever command is submitted through the form, and the output renders back in the browser. Committing the file requires creating a new branch:

![Azure DevOps "Commit to new branch" dialog over the cmd.aspx file. Comment field reads "Added file cmd.aspx". Branch name is "bad-payload" based on master. Work items to link shows item 1 "Check-in from your phone" (Updated 8/3/2020, Done). "Create a pull request" checkbox is checked. Commit and Cancel buttons at the bottom.](/writeups/htb-worker/06-commit-branch.png)

The commit goes to a branch named **bad-payload**, and the "Create a pull request" checkbox automatically opens a PR. Azure DevOps requires at least one linked work item to complete a PR — work item #1 "Check-in from your phone" satisfies that requirement. After approving and completing the merge, the Alpha-CI pipeline triggers automatically:

![Azure DevOps Pipelines Builds view showing the Alpha-CI pipeline history. One build entry — "Merged PR 10: Added file cmd.aspx", CI build for Nathalie Henley, Build #171 with a green success checkmark, master branch, queued 2020-12-06 23:...](/writeups/htb-worker/07-build-merged.png)

Build **#171** completes successfully — the pipeline has copied everything from the alpha repository, including `cmd.aspx`, to `w:\sites\alpha.worker.htb`. The webshell is now live at `alpha.worker.htb/cmd.aspx`.

Executing commands through the webshell confirms code execution as **iis apppool\defaultapppool** — the default IIS application pool identity. From here, downloading `nc64.exe` to the target and running it back to a listener provides a proper reverse shell. The defaultapppool account doesn't have access to user directories, so lateral movement is needed.

Enumerating the filesystem reveals the SVN repository storage on the `W:` drive. The file `W:\svnrepos\www\conf\passwd` contains plaintext credentials for SVN users, including `robisl = wolves11`. Testing these credentials with **evil-winrm**:

```
evil-winrm -i 10.10.10.203 -u robisl -p wolves11
```

The connection succeeds, and the user flag was retrieved from robisl's desktop.

---

## Privilege escalation — pipeline code execution

With robisl's credentials, logging back into Azure DevOps reveals access to a second project — **PartsUnlimited**. More importantly, robisl has permissions to create new pipelines. A CI/CD pipeline executes code on the build agent — and if the agent runs with elevated privileges, so does the code.

Creating a new pipeline in PartsUnlimited and selecting the ASP.NET Core starter template provides the YAML scaffold. Replacing the build steps with an inline PowerShell reverse shell:

![Azure DevOps New pipeline Review step for PartsUnlimited showing azure-pipelines.yml. The YAML contains ASP.NET Core template comments at the top, trigger on master, and a steps section with a PowerShell@2 task — timeoutInMinutes: 10, targetType: inline, and a script line containing a PowerShell TCP reverse shell using System.Net.Sockets.TCPClient connecting to 10.10.14.26 on port 4443.](/writeups/htb-worker/08-pipeline-yaml.png)

The pipeline YAML replaces the standard build steps with a single `PowerShell@2` task that runs an inline TCP reverse shell. The `targetType: 'inline'` setting means the script content executes directly without needing a separate file. Saving and running the pipeline triggers the build:

![Azure DevOps pipeline execution for PartsUnlimited build #20201207.1 "Set up CI with Azure Pipelines". Validation of 13 triggered just now for Robin Islip targeting PartsUnlimited master branch. Job running on Pool: Setup, Agent: Hamilton11. Started 12/7/2020 12:45:16 AM. Initialize job succeeded in less than 1 second, Checkout succeeded in 17 seconds, PowerShell task running. Output shows "Starting PowerShell" with task version 2.151.1 by Microsoft Corporation, "Generating script", and "Starting Command Output" executing powershell.exe with -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Unrestricted flags.](/writeups/htb-worker/09-pipeline-exec.png)

Build **#20201207.1** executes on agent **Hamilton11** in the Setup pool. The Initialize job and Checkout steps complete, and the PowerShell task fires — delivering a reverse shell with elevated privileges. The root flag was retrieved from the Administrator's desktop.

---

## What I took from this

Worker is fundamentally about trust in development infrastructure. The CI/CD pipeline is doing exactly what it's designed to do — automatically building and deploying code that gets merged to master. The vulnerability isn't in the pipeline's implementation; it's in who has access to trigger it and what the build agent is allowed to do. Nathen's credentials grant commit access to repositories that deploy to production web servers, and there's no code review gate beyond self-approval. A real organization would enforce branch policies requiring review from someone other than the author, restrict who can approve pull requests, and scan for known-dangerous file types in the pipeline.

The SVN credential leak is the classic version control mistake. Developers frequently commit secrets to repositories and then delete them, assuming the deletion removes the data. Every version control system preserves full history by design — `git log`, `svn log`, `svn diff` between revisions — all make "deleted" content trivially recoverable. The fix is credential rotation the moment a secret touches a repository, combined with pre-commit hooks or CI checks that scan for credential patterns before they enter history. The credentials in `deploy.ps1` were removed in a later commit, but that removal only affected the working copy, not the permanent record in the repository's history.

The privilege escalation through pipeline creation is the more subtle lesson. CI/CD agents are powerful — they execute arbitrary code in automated contexts, often with elevated permissions to deploy software, access secrets, or interact with production systems. Granting a user the ability to create or modify pipelines is effectively granting them code execution at the agent's privilege level. The principle of least privilege applies to DevOps permissions just as much as filesystem ACLs — pipeline creation should be restricted to a small set of trusted users, and agents should run with the minimum permissions their deployment tasks require.
