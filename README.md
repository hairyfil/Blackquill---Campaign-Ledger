BlackQuill v1.0.8
================

# BlackQuill Campaign Ledger v1.0.8

BlackQuill is a self-hosted, filesystem-based campaign ledger for tabletop RPGs.

Copyright © 2026 Phil Davidson. BlackQuill is open source under the MIT License. See [Licence](#licence) and the `LICENSE` file.

## Accounts

First start:

There is no built-in admin password. The first time you open BlackQuill in a browser (with no admin account in `system/users.json`), it shows a **First-time setup** page where you choose the admin username (default `admin`) and password (at least 8 characters). After that the setup page is gone and everyone uses the normal login page.

For Docker or other headless installs you can skip the page by setting `BLACKQUILL_ADMIN_PASSWORD` (and optionally `BLACKQUILL_ADMIN_USERNAME`) before the first start.

Everyone signs in on the same login page. The admin account opens the Admin Console (users, file checker, data sets, backups, settings). DM and player accounts open the campaign list. There are no domains any more (removed in v0.84).

Demo account (v0.86.4): BlackQuill also creates a read-only **demo** account, login `demo`, password `demo`. It sees what a player sees (all campaigns, player-visible notes, the SRD) but cannot add, change or delete anything; if it tries, a "blocked in demo mode" popup appears. The admin can change its password (User Management › Reset Password) or lock it, but cannot delete it. To let it see what a DM sees, change its role to dm in `system/users.json`; it stays read-only. If another account already uses the login `demo`, no demo account is created.

## Licence

BlackQuill is released under the MIT License. Copyright © 2026 Phil Davidson.

You may use, copy, modify, merge, publish, distribute, sublicense and sell copies of BlackQuill, as long as the copyright notice and the licence text in `LICENSE` are kept with it. It comes with no warranty. The campaign notes and pictures you create are yours.

Third-party material keeps its own licence: the open-source npm packages BlackQuill uses, and, if you import it, the SRD 5.1 (CC BY 4.0, Wizards of the Coast LLC) and the 5e-bits/5e-database data (MIT). BlackQuill no longer ships the SRD data itself.

## Data location

Persistent data lives outside the app folder:

```text
../blackquill-common-data/
```

Layout:

```text
blackquill-common-data/
  system/                 everything that is not campaign content
    users.json            all accounts: admin, dm, player
    settings.json         banner, style, icon pack, debug
    navigation.json       menu/category configuration
    audit.log
    templates/default/    intro.txt (login page text)
    styles/               style .json files
    icons/<pack>/         icon packs
    images/banners/       banners and other general graphics
    datasets/<dataset>/   reusable data sets to copy into a campaign
    backups/              backups made from the Admin Console
  campaigns/
    campaigns.json        campaign index
    <campaign-slug>/      one folder per campaign
      campaign.json
      notes/
      sessions/
      assets/
```

## Upgrading from v0.81 to v0.83.1

v0.86.3 no longer converts the old (domains) data layout. Start v0.86.2 once against the old `blackquill-common-data` folder; it moves everything into the current layout and takes a backup first. Then switch to v0.86.3.

## Install

Needs Node.js 22.12 or later (Node 24 LTS recommended). For simple step-by-step instructions, see `INSTALL.txt`.

The package comes with the app already built (`client/dist`), so installing only fetches the server's dependencies. There is nothing to build.

```bash
npm install --omit=dev
npm start
```

On Windows you can run:

```text
install.bat       (installs the server dependencies and applies npm audit fix)
runme.bat         (starts BlackQuill)
runme-debug.bat   (starts BlackQuill with debug mode forced on)
```

Debug mode can also be forced on from a command prompt with `runme.bat --debug`, `node server/index.js --debug`, or by setting `BLACKQUILL_DEBUG=1`. This overrides the saved admin setting, so it works even when you can't log in, and it logs each login attempt in the server window.

Run install.bat again whenever you want to update dependencies.

## Notes

No database is required. Notes are Markdown files with YAML frontmatter. Note assets live beside their note file.


## Admin Console

After logging in as the admin, the admin console shows:

- User Management: create/edit/lock/delete DM and player accounts (the admin account is protected)
- File Checker: validate folder/note structure and run safe repairs
- Data Sets: copy a data set from `system/datasets/` into a campaign, or copy one campaign's notes into another campaign (existing notes in the target are never overwritten)
- Backup / Restore: back up all data or a single campaign into `system/backups/`
- Settings: banner, style, icon pack and debug mode

## Password recovery

To change the admin password while you can still log in, use Admin Console › User Management › Change Password on the admin row (v1.0.2). If you have forgotten it:

Stop the server, open `system/users.json` and delete the admin entry (the one with `"role": "admin"`). At the next start the First-time setup page appears again so you can choose a new admin password. Other users are kept.

## SRD (System Reference Document)

The sidebar has an **SRD** entry under Reference. The first time a DM opens it, BlackQuill offers to import the D&D 5e System Reference Document 5.1. Since v1.0.8 BlackQuill does not include the SRD data; the DM brings it in:

- **Download SRD 5.1 from GitHub** fetches the JSON files from the 5e-bits/5e-database project (needs internet).
- **Upload JSON files…** imports the files you already have (from https://github.com/5e-bits/5e-database, folder `src/2014/en`). Select all 25 files at once; `5e-SRD-Spells.json` and `Spells.json` style names both work.
- **Import from folder** appears when the files are in `blackquill-common-data/system/srd/import/` (or `srd-data/5.1/` in the BlackQuill folder), for servers where uploading is awkward.

Until a DM imports it, the SRD page shows these choices to DMs and tells players to ask their DM. Nothing else in BlackQuill needs the SRD.

The data is stored once in `blackquill-common-data/system/srd/` and every campaign can browse it. After import, SRD shows the categories (races, classes, spells, monsters, equipment, magic items, feats, backgrounds, conditions, rules and more) with filters, search and linked entries. Players can browse it once a DM has imported it. A DM can update or remove it from the SRD page.

Attribution: This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode. JSON data from https://github.com/5e-bits/5e-database (MIT License).

## Linking notes

In a note's text, type `[[` and a list of matching campaign notes and SRD entries appears. Use the arrow keys and Enter (or click) to pick one.

- A note link is written as `[[Note Title]]`, or `[[Note Title|shown text]]`.
- An SRD link is written as `[[srd:spells/fireball|Fireball]]` (the autocomplete writes this for you). It opens the SRD entry.
- A plain `[[Fireball]]` with no note of that name opens the SRD entry with exactly that name, if there is one.
- If neither exists, clicking the link as DM creates an empty note with that title.

## v1.0.8

v1.0.8 is released under the MIT License (it was all rights reserved before) and no longer ships the SRD data (the srd-data folder is gone). A DM imports it from the SRD page: download it from GitHub, upload the JSON files, or import from a folder. An SRD you already imported is kept. The zip contains the full source. See release.txt.

## v1.0.7

v1.0.7 shows the admin a short "Create your first DM account" hint the first time they sign in to the Admin Console, explaining that the DM account is the one that creates, edits and runs campaigns. Its button opens Add user with the DM role chosen. It shows once, and never on installs that already have a DM. See release.txt.

## v1.0.6

v1.0.6 shows the default login banner as real text instead of a picture: "BlackQuill" in large gold lettering with "CAMPAIGN LEDGER" under it. It uses the app's fonts and takes the colours of the table's style, and stays sharp at any size. A banner image you uploaded or chose is still shown as before. See release.txt.

## v1.0.5

v1.0.5 gives the default login banner a large title: "BlackQuill" now fills most of the banner, with a ruled "CAMPAIGN LEDGER" line under it. If you never changed the banner, the new one replaces the old default on the next start; a banner you uploaded or chose is not touched. See release.txt.

## v1.0.4

v1.0.4 adds INSTALL.txt, a short step-by-step guide for installing and running BlackQuill. install.bat, runme.bat and runme-debug.bat now check for Node.js first: if it is missing, or older than 22.12, they say so, explain how to install it and offer to open the Node.js download page, instead of failing with a confusing error. See release.txt.

## v1.0.3

v1.0.3 makes the Style and Icon Pack settings work for everyone. The style chosen by the DM (Settings › Styles) or the admin (Admin Console › Settings) is now used on every browser, including the login page and the Admin Console. Players can still pick a style for their own browser. See release.txt.

## v1.0.2

v1.0.2 lets the admin change the admin password from the Admin Console (Change Password on the admin row; needs the current password). See release.txt.

## v1.0.1

v1.0.1 adds a Logout button (and who is signed in) to the Choose a campaign page, so you are no longer stuck there after deleting a campaign. See release.txt.

## v1.0

v1.0 is the first release. It has the same features as v0.87. The package ships the built app only: the client source code and the development notes are not included, and install.bat no longer builds anything. See release.txt.

## v0.87

v0.87 is a design pass based on the v0.86.3 design critique: notes without a picture are compact text cards, the new-entry editor puts writing first (pictures can be added before the first save, Atlas entries pick "Located in" from a list), Delete moves into a "⋯" menu in the reader, subcategory chips show counts, Settings has its own tabs, the Admin Console lists users first, and the login page has a new default banner. No data changes. See release.txt.

## v0.86.5

v0.86.5 adds a Delete… button for DMs on each card of the Choose a campaign page and fixes deleting campaigns made by older versions. Deleting still needs the full campaign name typed and cannot be undone. See release.txt.

## v0.86.4

v0.86.4 adds the read-only demo account (login `demo`, password `demo`), described under Accounts. The server refuses every change from it, not just the screens. See release.txt.

## v0.86.3

v0.86.3 is a clean-up release: unused and duplicated code removed, two security holes closed (anyone could download `system/users.json` through the banner address, and players could read DM Secrets through the picture address), Settings › Navigation keeps disabled menus, and all libraries are on their current versions (Express 5, React 19.3, Vite 8.3, markdown-it 15, bcryptjs 3). See release.txt.

## v0.86.2

v0.86.2 lets a DM delete a campaign from Settings › Campaign. You must type the campaign's full name to confirm, and the deletion cannot be undone. See release.txt.

## v0.86.1

v0.86.1 starts a new entry in the section you are viewing (for example Atlas › City) and shows an "Imported from the Forgotten Realms Wiki" notice with the original link at the top of imported notes. See release.txt.

## v0.86

v0.86 checks the Forgotten Realms Wiki while you type a new entry's name, suggests the closest article when there is no exact one, and imports the article's text and pictures into the entry's own folder, with the source link and licence kept on the note. See release.txt.

## v0.85.1

v0.85.1 adds `[[` autocomplete in the note editor and links to SRD entries. See release.txt.

## v0.85

v0.85 adds the SRD browser to the sidebar. See release.txt.

## v0.84.6

v0.84.6 removes the built-in admin/blackquill account: on first start BlackQuill asks for the admin password in the browser. See release.txt.

## v0.84.5

v0.84.5 shows the running app version in small text at the right end of the top bar and in the Admin Console header. See release.txt.

## v0.84.4

v0.84.4 turns Dashboard into a campaign overview (section counts, latest session log, open quests, recently updated entries) and stops players receiving DM Eyes Only notes from the server. See release.txt.

## v0.84.3

v0.84.3 adds a House Rules and Rulings section to the sidebar, above Adventure Groups. Players can read it; only the DM can add, edit or delete entries. See release.txt.

## v0.84.2

v0.84.2 puts the Debug Mode checkbox in Admin Settings directly beside its label. See release.txt.

## v0.84.1

v0.84.1 lets Admin > Data Sets copy one campaign's notes into another campaign. See release.txt.

## v0.84

v0.84 removes domains and flattens the data folder into `system/` and `campaigns/`, with an automatic one-time migration from the old layout. See release.txt.

## v0.83.1

v0.83.1 fixes Settings > Styles: six built-in styles, a live-preview style gallery, and theme-derived colours throughout. See release.txt.

## v0.83

v0.83 is a UI/UX redesign of the client: new topbar and sidebar, page headers with subcategory chips, redesigned note cards and reader, empty states, a mobile slide-out menu and accessibility fixes. Functionality, data layout, scripts and debug mode are unchanged. See release.txt.

## v0.82

v0.82 adds `npm audit fix` to install.bat, splits install (install.bat) from run (runme.bat), and adds command-line debug mode (runme-debug.bat, `--debug`, `BLACKQUILL_DEBUG=1`) with login tracing. See release.txt.

## v0.81

v0.81 adds Admin Settings and a domain/campaign-aware dataset copy workflow.
