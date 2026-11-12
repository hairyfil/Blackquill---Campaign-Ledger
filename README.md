BlackQuill Campaign Ledger
A self-hosted campaign notebook for D&D and other tabletop RPGs.
BlackQuill gives the DM and players one place to keep the world, the people in it, the factions, quests, loot and session logs. It runs on your own computer or server, needs no database, and stores every note as a plain Markdown file you own.
![Version](https://img.shields.io/badge/version-1.0.8-b8860b)
![Node](https://img.shields.io/badge/node-%3E%3D22.12-339933)
![License](https://img.shields.io/badge/license-MIT-blue)
---
Features
A ready-made campaign structure
Ten sections out of the box: Adventure Groups (parties and PCs), Chronicle (session logs, party journal, discoveries, rumours, loot history), Atlas (from a whole world down to a single dwelling or site), Personae, Organisations, Armory, Codex, Quests, Session Archive, and House Rules and Rulings.
Customisable menus: the DM can reorder sections, switch them on or off, and add subcategories.
Many campaigns on one install, with a campaign switcher in the top bar.
Dashboard
A tile and entry count for every section.
The latest session log, open quests and the most recently updated entries at a glance.
Search across the whole campaign.
Notes and linking
Every entry is Markdown, shown on a parchment-style reader page.
Wiki links: type `[[` in a note and pick from matching campaign notes and SRD entries. Links look like `[[Note Title]]` or `[[Note Title|shown text]]`.
A DM can click a link to a note that does not exist yet to create it.
Pictures per note, stored in the note's own folder.
Forgotten Realms Wiki import: while you type a new entry's name, BlackQuill looks it up on the Forgotten Realms Wiki, suggests the closest article, and can import its text and pictures with the source link and licence kept on the note.
Built-in SRD 5.1 browser
Browse the D&D 5e System Reference Document 5.1: races, classes, spells, monsters, equipment, magic items, feats, backgrounds, conditions and rules.
Filters where they matter: spells by level, class and school; monsters by challenge rating, type and size; magic items by rarity.
Full monster stat blocks, spell details, class level tables and spell lists, with cross-links between entries.
Link any SRD entry from a note, for example `[[srd:spells/fireball|Fireball]]`.
The SRD data is not bundled. A DM imports it once from the SRD page (see SRD data).
The DM stays in control
DM Eyes Only: a private section for story arcs, key story points and the DM's to-do list. The server never sends these notes to players.
DM Secrets: a private secrets page attached to any note.
House Rules and Rulings: everyone can read them, only the DM can change them.
These rules are enforced by the server, not just hidden in the interface.
Looks and layout
Six built-in styles: Default, Parchment Day (light), Emerald Grove, Frost Arcane, Crimson Keep and Shadowfell, with a live-preview gallery.
The DM's chosen style applies for everyone; players can pick their own for their browser.
Custom styles, banners and icon packs can be added as files.
Works on phones and tablets, with keyboard and screen-reader support.
Accounts and administration
Three roles: admin, DM and player, with one login page for everyone.
First-run setup: you choose the admin password in the browser. There is no default admin password.
Read-only demo account (`demo` / `demo`) that sees what a player sees and cannot change anything. The admin can change its password or lock it.
Admin Console: user management, a file checker with safe repairs, backups of everything or a single campaign, data sets, and site settings.
Copy notes from one campaign into another without overwriting anything.
An audit log of admin and SRD actions.
---
Quick start
Requirements
Node.js 22.12 or later (Node 24 LTS recommended).
The built client (`client/dist`) is included, so there is nothing to build to run BlackQuill.
Windows
Install Node.js.
Download or clone this repository.
Double-click `install.bat` (one time; it downloads the server's dependencies).
Double-click `runme.bat` and leave its window open.
Open http://localhost:3001 in your browser and choose the admin username and password.
`install.bat` and `runme.bat` check your Node.js version first and tell you what to do if it is missing or too old. See INSTALL.txt for step-by-step instructions.
macOS and Linux
```bash
npm install --omit=dev
npm start
```
Then open http://localhost:3001.
Docker
```bash
docker compose up -d
```
Campaign data is kept in `./blackquill-common-data` on the host. To skip the browser setup page on a headless server, set `BLACKQUILL_ADMIN_PASSWORD` before the first start.
Playing at the table
Other people on the same network can open `http://<this computer's IP address>:3001`. On Windows, allow Node.js through the firewall on private networks when asked.
> **First start:** whoever opens BlackQuill first while no admin exists chooses the admin password. Do the first start yourself before letting anyone else reach the app.
---
Getting started after install
Sign in as the admin. The Admin Console opens.
Create a DM account (the admin sees a hint for this on first sign-in).
Sign in as the DM and create your first campaign.
Create player accounts in the Admin Console for the people at your table.
Optionally, open SRD in the sidebar and import the SRD data.
---
SRD data
BlackQuill does not ship the SRD data. A DM imports it once from the SRD page, in one of three ways:
Download SRD 5.1 from GitHub: fetches the JSON files from 5e-bits/5e-database (needs internet).
Upload JSON files: select the files from the 5e-database `src/2014/en` folder.
Import from folder: put the files in `blackquill-common-data/system/srd/import/` and import from there.
The data is stored once and shared by every campaign. A DM can update or remove it later from the same page. Nothing else in BlackQuill needs the SRD.
---
Your data
BlackQuill keeps everything in a folder next to the app folder, not inside it:
```text
blackquill-common-data/
  system/        accounts, settings, menus, styles, icons, banners, data sets, backups, SRD
  campaigns/
    <campaign>/  campaign.json, notes/, sessions/, assets/
```
Notes are Markdown files with YAML front matter. You can read them, copy them, or keep them in version control.
To upgrade, unpack the new version next to the same `blackquill-common-data` folder. Your campaigns are kept.
Back up this folder to keep your campaigns safe, or use Backup / Restore in the Admin Console.
The data folder is never part of this repository.
---
Configuration
Variable	Default	What it does
`PORT`	`3001`	Port the server listens on.
`BLACKQUILL_DATA`	`../blackquill-common-data`	Where campaign data, accounts and settings are stored.
`BLACKQUILL_ADMIN_PASSWORD`	not set	Creates the admin account on first start, skipping the setup page (8+ characters).
`BLACKQUILL_ADMIN_USERNAME`	`admin`	Admin username used with `BLACKQUILL_ADMIN_PASSWORD`.
`SESSION_SECRET`	built-in development value	Secret used to sign login sessions. Set your own long random value on any install other people can reach.
`BLACKQUILL_DEBUG`	off	Set to `1` to force debug mode, which logs each login attempt and more detail in the server window.
Debug mode can also be turned on with `runme-debug.bat` or `node server/index.js --debug`.
---
Password recovery
You know the admin password: Admin Console > User Management > Change Password on the admin row.
You forgot it: stop the server, open `blackquill-common-data/system/users.json`, delete the entry with `"role": "admin"`, and start again. The first-time setup page appears so you can choose a new password. Other accounts are kept.
---
Development
```text
server/        Express server and API
client/src/    React client source
client/dist/   Built client (committed, so users do not need to build)
```
After changing anything in `client/src`, rebuild the client and commit the new `client/dist`:
```bash
cd client
npm ci
npm run build
```
For live reloading, run the BlackQuill server on port 3001 and then `npm run dev` in `client/`.
release.txt lists what changed in each version.
---
Licence
BlackQuill is released under the MIT License. Copyright (c) 2026 Phil Davidson.
The campaign notes and pictures you create are yours. Third-party material keeps its own licence:
SRD 5.1: this work can include material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License.
5e-database: SRD JSON data from 5e-bits/5e-database (MIT License).
Forgotten Realms Wiki: imported article text is CC BY-SA 3.0; BlackQuill keeps the source and licence on each imported note. Imported pictures keep their own licences, and many are copyrighted artwork, so keep them for your own table.
BlackQuill is not affiliated with Wizards of the Coast or Fandom.
