---
title: 'Dumping Router Firmware'
target: 'TryHackMe — Dumping Router Firmware'
difficulty: 'easy'
date: 2025-08-29
summary: 'A hands-on walkthrough of router firmware reverse engineering — cloning and extracting a Linksys WRT1900ACS v2 firmware image, analysing it with strings and binwalk to identify the embedded operating system and architecture, extracting the JFFS2 filesystem, mounting it on a Linux host, and exploring the router internals: BusyBox-based userland, Dropbear SSH server, Twonky media server configuration, build metadata, and JNAP network management modules.'
role: 'forensics'
tags: ['firmware-analysis', 'binwalk', 'strings', 'jffs2', 'router', 'iot', 'filesystem', 'linksys', 'reverse-engineering']
problem: 'Router firmware images are opaque binary blobs that contain everything needed to run the device — bootloader, kernel, filesystem, configuration, and application logic. Understanding what is inside a firmware image is essential for vulnerability research, IoT security assessments, and incident response involving compromised network devices. The task is to extract, analyse, and mount the filesystem from a Linksys WRT1900ACS v2 firmware image using standard Linux tools.'
action: 'Cloned the firmware repository and extracted the multi-volume zip archive with 7z, verified the image integrity with sha256sum, ran strings to identify plaintext content including the device name and operating system, used binwalk to enumerate embedded components (uImage header, ARM kernel, gzip compressed data, device tree, JFFS2 filesystem), extracted the firmware layers with binwalk -e, ran a second binwalk pass on the gzip-compressed kernel image to identify the Linux kernel version, mounted the JFFS2 filesystem using mtdblock and explored the full directory structure — bin, etc, JNAP modules, and configuration files.'
outcome: 'Identified the firmware as a Linksys WRT1900ACS Router running Linux on ARM architecture, extracted the uImage header with creation date 2020-04-22 11:07:26 and data CRC 0xABEBC439, determined the embedded Linux kernel version as 3.10.39, successfully mounted the JFFS2 filesystem revealing a BusyBox-based root filesystem with Dropbear SSH, a Cisco/Twonky media server, SQLite3 database, firmware version 2.0.3.201002 with build date 2020-04-22 11:44, and JNAP modules managing guest_lan, lan, and wan networks.'
draft: false
---

## Background

Routers sit at the boundary between internal networks and the internet, handling every packet that crosses the perimeter. That position makes them high-value targets — and understanding what runs inside them is fundamental to assessing their security posture. This room walks through the process of taking a production firmware image (Linksys WRT1900ACS v2), tearing it apart with standard Linux utilities, and exploring the filesystem that powers the device.

The approach is methodical: start with coarse-grained tools like `strings` to identify readable content, move to `binwalk` for structural analysis of the binary image, extract embedded filesystems, mount them, and then explore the directory tree as if the router were a regular Linux box — because under the hood, it is one.

The prerequisites are straightforward: a Linux system (or WSL) with `binwalk`, `strings`, and JFFS2 support installed. JFFS2 support requires the `jefferson` tool, which can be set up with:

```
sudo pip install cstruct
git clone https://github.com/sviehb/jefferson
cd jefferson && sudo python setup.py install
```

---

## Obtaining and preparing the firmware

The firmware image is hosted in a GitHub repository. Cloning it, extracting the multi-volume zip archive with 7z, and verifying the image hash:

```
sudo git clone https://github.com/Sq00ky/Dumping-Router-Firmware-Image/ /opt/Dumping-Router-Firmware
cd /opt/Dumping-Router-Firmware/
sudo 7z x ./FW_WRT1900ACSV2_2.0.3.201002_prod.zip
sha256sum FW_WRT1900ACSV2_2.0.3.201002_prod.img
```

![TryHackMe terminal showing git clone of the Dumping-Router-Firmware-Image repository, 7z extraction of the multi-volume zip (Physical Size 9216951, Total Physical Size 30188471, 3 volumes), ls revealing the .img, .z01, .z02, README.md and .zip files, and sha256sum output for the firmware image: dbbc9e8673149e79b7fd39482ea95db78bdb585c3fa3613e4f84ca0abcea68a4.](/writeups/thm-dumping-router-firmware/01-clone-extract-sha256.png)

The 7z extraction handles the multi-volume archive (3 volumes, total physical size ~30MB), producing the raw firmware image `FW_WRT1900ACSV2_2.0.3.201002_prod.img`. The sha256 hash provides a baseline for integrity verification.

---

## Analysing with strings and binwalk

The first pass uses `strings` to pull human-readable content from the binary image. Even without any structural understanding of the file format, strings reveals useful metadata:

```
strings FW_WRT1900ACSV2_2.0.3.201002_prod.img | head
```

![TryHackMe terminal showing strings output piped to head — first line reads Linksys WRT1900ACS Router, followed by miscellaneous text fragments including system messages like System halted, Attempting division by 0, Uncompressing Linux, decompressor returned an error, done booting the kernel, invalid distance too far back, invalid distance code.](/writeups/thm-dumping-router-firmware/02-strings-output.png)

The first clear text line identifies the device: **Linksys WRT1900ACS Router**. The strings output also reveals the operating system — the "Uncompressing Linux..." and "done, booting the kernel." messages confirm this is a **Linux**-based device. These are standard Linux kernel boot messages embedded in the firmware image.

For structural analysis, `binwalk` parses the binary and identifies embedded file types, compression schemes, and filesystem signatures. The `-e` flag is what tells binwalk to extract files from the image:

```
binwalk FW_WRT1900ACSV2_2.0.3.201002_prod.img
```

![TryHackMe terminal showing ls output of the extracted firmware files, then binwalk output in three columns (DECIMAL, HEXADECIMAL, DESCRIPTION) — offset 0x0: uImage header with header size 64 bytes, header CRC 0xFF40CAEC, data CRC 0xABEBC439, OS Linux, CPU ARM, image name Linksys WRT1900ACS Router; offset 0x40: Linux kernel ARM boot executable zImage (little-endian); offset 0x6870: gzip compressed data; offset 0x404DF0: Flattened device tree, 15563 bytes, version 17; offset 0x600000: JFFS2 filesystem, little endian.](/writeups/thm-dumping-router-firmware/03-binwalk-firmware.png)

The binwalk output breaks down the firmware into its constituent parts. The first item extracted is a **uImage header** — the U-Boot bootloader's image wrapper. The header metadata reveals the creation date (2020-04-22 11:07:26), the data CRC (**0xABEBC439**), and the architecture: **ARM**. The image size embedded in the header is **4229755 bytes**.

Following the header, binwalk identifies the Linux kernel as an ARM boot executable (zImage format, little-endian) at offset 0x40, gzip-compressed data at 0x6870, a flattened device tree at 0x404DF0, and a JFFS2 filesystem at offset 0x600000.

Running `binwalk -e` on the firmware image extracts these components into a directory named `_FW_WRT1900ACSV2_2.0.3.201002_prod.img.extracted`, containing two key files: `600000.jffs2` (the filesystem) and `6870` (the compressed kernel image).

The gzip-compressed file `6870` can be analysed further with a second binwalk pass to extract additional embedded content:

```
binwalk -e 6870
```

![TryHackMe terminal showing the extracted directory contents (600000.jffs2 and 6870), then binwalk -e 6870 output — a long list of identified components including SHA256 hash constants, Linux kernel version 3.10.3, AES S-Box and Inverse S-Box, Unix paths (/var/run/rpcbind.sock, /dev/vc/0), xz compressed data, firmware update path /lib/firmware/updates/3.10.39, Ubiquiti firmware additional data (UTE DEVICE DIAGNOSTIC), copyright strings from Rodolfo Giometti and Pierre Ossman, Neighborly text entries, LZMA compressed data, ASCII cpio archives (dev, dev/console, root, TRAILER), CRC32 polynomial table, and Marvell International copyright.](/writeups/thm-dumping-router-firmware/04-binwalk-6870.png)

The second binwalk pass reveals the embedded Linux kernel version: **3.10.39**, visible in the firmware update path `/lib/firmware/updates/3.10.39`. The output also shows AES S-Box tables (indicating built-in cryptographic support), ASCII cpio archives containing the initial root filesystem (`dev/`, `dev/console`, `root/`), and copyright strings from Marvell International — the SoC manufacturer for the WRT1900ACS.

---

## Mounting the JFFS2 filesystem

JFFS2 (Journalling Flash File System 2) is a log-structured filesystem designed for NOR flash memory, commonly used in embedded devices. Mounting it on a standard Linux system requires creating a virtual MTD (Memory Technology Device) block device and loading the appropriate kernel modules:

```
rm -rf /dev/mtdblock0
mknod /dev/mtdblock0 b 31 0
mkdir /mnt/jffs2_file/
modprobe jffs2
modprobe mtdram
modprobe mtdblock
dd if=/opt/Dumping-Router-Firmware/_FW_WRT1900ACSV2_2.0.3.201002_prod.img.extracted/600000.jffs2 of=/dev/mtdblock0
mount -t jffs2 /dev/mtdblock0 /mnt/jffs2_file/
cd /mnt/jffs2_file
```

The `modprobe` commands load the JFFS2 filesystem driver, the MTD RAM emulation module (which creates a RAM-backed MTD device), and the MTD block device translation layer. The `dd` command writes the extracted JFFS2 image into the virtual MTD device, and `mount` attaches it to the directory tree.

![TryHackMe terminal showing the mounted JFFS2 filesystem at /mnt/jffs2_file — ls output showing directories bin, cgroup, dev, etc, home, JNAP, lib, linuxrc, mnt, opt, proc, root, sbin, sys, tmp, usr, var, www. The ls -la output reveals linuxrc is a symlink to bin/busybox, mnt links to /tmp/mnt, opt links to /tmp/opt, and var links to /tmp/var. Directory timestamps are dated April 2020 and January 1970.](/writeups/thm-dumping-router-firmware/05-mounted-filesystem.png)

The mounted filesystem reveals a standard Linux root directory structure. The `linuxrc` init script is a symlink to **bin/busybox** — this tells us the entire userland is built on BusyBox, a single binary that provides stripped-down versions of common Unix utilities. The `mnt`, `opt`, and `var` directories all symlink to subdirectories under **/tmp**, which is typical for embedded devices where flash wear needs to be minimised — writable runtime data goes to a RAM-backed tmpfs rather than the flash filesystem.

The `/www/` directory would store the router's HTTP server files — the web-based admin interface that users interact with through their browser.

---

## Exploring the filesystem

### /bin — BusyBox userland

```
cd bin/
ls
ls -la | head
```

![TryHackMe terminal showing /mnt/jffs2_file/bin contents — utilities listed alphabetically including addgroup, adduser, ash, attr, busybox, cat, catv, chacl, chgrp, chmod, chown, cp, cpio, curl, curl-config, date, dd, delgroup, deluser, df, dmesg, dnsdomainname, dumpkmap, echo, ed, egrep, false, fgrep, getfacl, getfattr, grep, gunzip, gzip, hostname, ip, ip6calc, ipcalc, kill, ln, login, ls, mkdir, mknod, mktemp, more, mount, mountpoint, mt, mv, netstat, nice, openssl, pidof, ping, ping6, pipe_progress, printenv, ps, pwd, rm, rmdir, rpm, run-parts, sed, setfacl, setfattr, sh, sleep, smbpasswd, sqlite3, stat, stty. The ls -la output shows most files are symlinks to busybox (593280 bytes), with attr being a standalone binary (7112 bytes).](/writeups/thm-dumping-router-firmware/06-bin-directory.png)

The vast majority of binaries in `/bin` are symlinks to **busybox** — a single 593KB executable that implements all of these utilities. This is standard practice in embedded Linux: rather than shipping hundreds of individual binaries, BusyBox multiplexes based on the name it was invoked with. The standalone `attr` binary (7112 bytes) and `curl` are notable exceptions.

The presence of **sqlite3** in the bin directory indicates a database service running on the router, likely used for configuration storage or logging.

### /etc — Configuration and build metadata

```
cd etc/
ls
cat builddate
```

![TryHackMe terminal showing /mnt/jffs2_file/etc directory listing — configuration files including 24G/5G power tables for different regions (AP, AU, CA, CE, FCC, PH), builddate, builddetails, buildrev, certs directory, cloud_dns_names, cron directory, ddns_update files, devregex.json, dhclient.conf, dhcp6s.conf, dhcp_options, dhcp_static_hosts, dnsmasq files, dropbear_dss_host_key and dropbear_rsa_host_key, ebtables, environment, ethertypes, files-to-keep.conf, FW_LICENSE_default.pdf.gz, group, guardian directory, hostname, hosts, hotplug files, IGD, igmproxy.conf, init.d, inittab, iproute2, l2tp, l7-protocols, ld.so.conf, led, lighttpd.conf, localtime, mediaserver.ini, mini_httpd.conf, modprobe.d, nvram.cleanup.lst, otherservices, passwd, persistence_settings, ppp, product, product.type, profile, protocols, radvd.conf, regcode, registration.d, resolv.conf, ripd.conf, scsi_id.config, security directory, services, shadow, srvlst, ssmtp, ssmtp-sample, sysconfig, syseventp.conf, syseventrelay.conf, system, system_defaults, timesettings, udev, VLANTagging_ISP_Profile, version, vsftpd.conf, wifi_power_table, zebra.conf. The cat builddate output shows: 2020-04-22 11:44.](/writeups/thm-dumping-router-firmware/07-etc-builddate.png)

The `/etc` directory is dense with configuration. The build date of the firmware is **2020-04-22 11:44**. The SSH server files `dropbear_dss_host_key` and `dropbear_rsa_host_key` identify **Dropbear** as the SSH daemon — a lightweight SSH server designed for embedded and resource-constrained environments, much smaller than OpenSSH.

The `services` file contains the standard mapping of network services to port numbers. The `system_defaults` file holds the factory default system settings. The firmware version can be found in the `version` file: **2.0.3.201002**.

Other notable configuration includes per-region wireless power tables (24G and 5G for AP, AU, CA, CE, FCC, PH regions), `vsftpd.conf` for the FTP server, `lighttpd.conf` for the web server, `dnsmasq` for DNS/DHCP, `zebra.conf` and `ripd.conf` for routing protocols, and `ssmtp` for outbound email.

### /etc — Media server identification

```
cat mediaserver.ini | head
```

![TryHackMe terminal showing /mnt/jffs2_file/etc directory listing again, then cat mediaserver.ini piped to head — the file header reads: Cisco MediaServer ini file (twonky revision) / charset UTF-8, change settings by editing this file, version 5.1.05. Configuration parameters listed include contentbase, httpport=9999, enableweb, and scantime.](/writeups/thm-dumping-router-firmware/08-etc-mediaserver.png)

The media server configuration identifies **Cisco** as the developer — it's a Twonky-based DLNA media server (version 5.1.05) running on HTTP port 9999. Twonky is a UPnP/DLNA media server commonly bundled with consumer routers and NAS devices for media streaming on the local network.

### /JNAP — Network management modules

```
cd JNAP/
ls
cd modules/
ls
```

![TryHackMe terminal showing /mnt/jffs2_file/JNAP directory containing a modules subdirectory, then listing the modules — Lua scripts for various router functions: core_server.lua, ddns_server.lua, devicelist_server.lua, diagnostics_server.lua, dynamicportforwarding_server.lua, dynamicsession_server.lua, firewall_server.lua, firmwareupdate_server.lua, ftpserver_server.lua, guest_lan (directory, highlighted green), guestnetworkauth_server.lua, guestnetwork_server.lua, httpproxy_server.lua, lan (directory, highlighted green), locale_server.lua, macfilter_server.lua, networkconnections_server.lua, networktraffic_server.lua, openvpn_server.lua, ownednetwork_server.lua, parentalcontrol_server.lua, qos_server.lua, reliability_server.lua, routerleds_server.lua, routerlog_server.lua, routermanagement_server.lua, router_server.lua, routerupnp_server.lua, smbserver_server.lua, storage_server.lua, ui_server.lua, upnpmediaserver_server.lua, vlantagging_server.lua, wan (directory, highlighted green), wirelessap_m, wirelessap_s, wirelesssche.](/writeups/thm-dumping-router-firmware/09-jnap-modules.png)

JNAP (Linksys Network Access Protocol) is Linksys's proprietary API for managing router configuration, replacing the older HNAP protocol. The modules directory contains Lua scripts implementing every management function: firewall rules, port forwarding, QoS, parental controls, DDNS, OpenVPN, MAC filtering, firmware updates, and more.

The three network directories within the modules folder are **guest_lan**, **lan**, and **wan** — representing the three distinct network segments the router manages. Each has its own configuration namespace for network-specific settings like DHCP ranges, VLAN tagging, and access policies.

---

## What I took from this

Firmware analysis demystifies devices that most people treat as black boxes. The WRT1900ACS is a consumer router, but internally it's a full ARM Linux system with a BusyBox userland, Dropbear SSH, a Twonky media server, SQLite for data storage, and a Lua-based management API. Every one of those components has its own attack surface — known CVEs, default configurations, hardcoded credentials — and they're all discoverable from the firmware image without ever powering on the device.

The tooling is remarkably accessible. `strings` and `binwalk` are enough to go from an opaque binary blob to a mounted filesystem you can browse like any Linux box. The fact that the kernel version (3.10.39), build date, SSH server type, media server vendor, and complete network architecture are all extractable from a publicly available firmware download is exactly what makes firmware analysis valuable for both defenders (understanding what's running on their network) and attackers (identifying outdated components and misconfigurations).

The JFFS2 mounting process is the most involved step, but once the filesystem is accessible, the analysis becomes standard Linux forensics — checking symlinks, reading configuration files, identifying services, and mapping the software inventory. For anyone doing IoT security assessments, this workflow of download-extract-mount-explore is the starting point for every device.
