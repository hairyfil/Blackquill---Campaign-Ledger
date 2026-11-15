import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { PATHS } from "./filesystem/paths.js";
import { addCampaign, listCampaignFolders } from "./filesystem/campaigns.js";
import { getNoteMarkdownPath, normalizeNoteData } from "./filesystem/notes.js";
import { ensureDir } from "./fsdb.js";

// v1.0.9: a fresh install starts with one example campaign holding a few example cards:
// a Markdown cheat sheet, a card on [[ ]] links, a card on changing the menus, a made-up village, a person who lives
// there and a quest that ties them together. It is created only on a truly fresh install
// (no campaigns.json and no campaign folders yet), so upgrades never get it and a DM who
// deletes it never sees it come back.

export const EXAMPLE_CAMPAIGN = { slug: "example-campaign", name: "Example Campaign" };

const CHEAT_SHEET = `Welcome to BlackQuill! Every entry in your campaign is written in **Markdown**, a simple way to format text with ordinary characters. This card is a quick reference for formatting. Click **Edit** to see exactly how it was written, and feel free to change or delete it.

## Headings

Start a line with \`#\` signs. One \`#\` is the biggest heading, \`######\` the smallest.

\`\`\`
# Big heading
## Section heading
### Smaller heading
\`\`\`

## Emphasis

- \`**bold**\` gives **bold**
- \`*italic*\` gives *italic*
- \`***bold and italic***\` gives ***bold and italic***
- \`~~struck out~~\` gives ~~struck out~~

## Lists

\`\`\`
- Rope, 50 feet
- Torches (6)
  - Indent with two spaces for a sub-item

1. Find the bell
2. Ring the bell
3. Run
\`\`\`

- Rope, 50 feet
- Torches (6)
  - Indent with two spaces for a sub-item

1. Find the bell
2. Ring the bell
3. Run

## Quotes

Start a line with \`>\` for boxed text, a letter or a prophecy:

> *When the bell rings beneath the water, the Hollow will remember its debts.*

## Web links and pictures

- \`[Link text](https://example.com)\` makes an ordinary web link.
- \`![Description](https://example.com/map.png)\` shows a picture from the web. To add your own pictures, use the image upload when you edit an entry.

## Tables

\`\`\`
| Item        | Cost  | Weight |
| ----------- | ----- | ------ |
| Lantern     | 5 gp  | 2 lb   |
| Rations (1) | 5 sp  | 2 lb   |
\`\`\`

| Item        | Cost  | Weight |
| ----------- | ----- | ------ |
| Lantern     | 5 gp  | 2 lb   |
| Rations (1) | 5 sp  | 2 lb   |

## Code and dividers

- Wrap text in backticks for \`inline code\`, or put three backticks on the lines above and below a block.
- A line of three dashes, \`---\`, draws a divider:

---

## Linking to other entries

Links between entries use double square brackets instead of Markdown's \`[text](address)\`. They have their own card: [[How to Link Entries]].

## Good to know

- Everything you write is saved as a plain Markdown file in your data folder, so it is yours to keep.
- **DM Secrets** (on any entry) holds notes that players never see.
- Entries in **DM Eyes Only** are never sent to players.
`;

const VILLAGE = `*A fog-bound fishing village on the edge of the Mirefen, built on stilts above slow black water.*

## At a glance

- **Population:** About 220, mostly fisherfolk and reed-cutters
- **Ruled by:** The Council of Nets (five elders, one vote each)
- **Known for:** Smoked eel, reed baskets, and a bell no one has heard in sixty years
- **Dangers:** Sinkholes, will-o'-wisps, and the Mirefen itself after dark

## Description

Thornwick Hollow sits where three slow rivers meet and give up. The houses stand on blackened oak stilts joined by rope bridges and plank walks, and every family keeps a flat-bottomed punt tied below the door. Fog rolls in each evening and does not lift until mid-morning.

At the centre of the village stands the **Drowned Chapel**, a stone bell tower that sank into the mire long ago. Only its top storey shows above the water, and its bell is gone.

## Places of note

- **The Lantern & Eel**, the only inn, run by [[Old Maren Vosk]]. Warm, smoky and full of stories.
- **The Net Hall**, where the Council of Nets meets and where travellers must register before staying the night.
- **Weeping Steps**, a stair cut into the bank that leads down into the water and keeps going.
- **The Drowned Chapel**, off limits by order of the Council.

## Rumours

1. On still nights, fishermen swear they hear a bell ringing far below the water.
2. The Council pays well for anyone who brings back an eel longer than a punt.
3. A stranger in a grey cloak was asking about the chapel last week.

## Hooks

- The village needs someone to recover its lost bell. See [[The Drowned Bell]].
- Lights move across the Mirefen at night. Locals call them corpse-candles; scholars would call them [[srd:monsters/will-o-wisp|will-o'-wisps]].
`;

const INNKEEPER = `*Innkeeper of the Lantern & Eel in [[Thornwick Hollow]]. Sharp-eyed, slow-spoken, and older than she admits.*

## At a glance

- **Role:** Innkeeper, unofficial village memory
- **Age:** Late seventies
- **Attitude to the party:** Friendly, if they pay and wipe their boots
- **Wants:** The bell found before she dies

## Appearance

A small, broad woman with weather-browned skin, silver hair braided with fishing line, and a pipe that is never quite lit. She walks with a heron-headed cane she does not need.

## Personality

- Answers a question with a question, then answers the first one anyway.
- Keeps a ledger of every traveller who has stayed at the inn in the last fifty years.
- Will not set foot on the Weeping Steps, and will not say why.

## What she knows

- She was a girl the last time the chapel bell rang, the night the tower sank.
- Her brother rowed out to the tower that night and never came back.
- She believes the bell is still down there, and that someone took it on purpose.

## Roleplaying tips

Speak slowly. Let silences stretch. Offer the party a bowl of eel stew before talking business, and be offended if they refuse.

Quest: [[The Drowned Bell]].
`;

const QUEST = `*The bell of the Drowned Chapel has been silent for sixty years. Now someone is ringing it.*

- **Given by:** [[Old Maren Vosk]] at the Lantern & Eel
- **Where:** [[Thornwick Hollow]], the Drowned Chapel and the waters beneath it
- **Suggested level:** 1 to 3

## Background

Sixty years ago the chapel tower of Thornwick Hollow sank into the Mirefen in a single night, and its bronze bell vanished with it. This month fishermen have begun to hear it ringing beneath the water on still nights, and three of them have not come home.

## Objectives

- Hear Maren's story at the Lantern & Eel.
- Get the Council of Nets to lift its ban on the Drowned Chapel.
- Find a way into the flooded tower.
- Discover who, or what, is ringing the bell.
- Bring the bell (or the truth) back to the village.

## Complications

- A creature is nesting in the flooded belfry. A swarm or a single [[srd:monsters/giant-frog|giant frog]] works well for a low-level party.
- The stranger in the grey cloak wants the bell too.
- Characters who go under the water need a way to breathe. A scroll of [[srd:spells/water-breathing|water breathing]] would make a fine advance from the Council.

## Reward

The Council of Nets offers 50 gp and free lodging for life at the Lantern & Eel. Maren offers something she will only describe as "my brother's."

*Use this card as a pattern for your own quests, or delete it when you are ready to start your real campaign.*
`;

const LINKS = `Any entry can link to any other entry in the campaign, and to the SRD. Click a link to open what it points to. Click **Edit** on this card to see how each link below was written.

## The basics

Put the name of another entry between double square brackets:

- \`[[Thornwick Hollow]]\` links to the entry called Thornwick Hollow: [[Thornwick Hollow]]
- \`[[Thornwick Hollow|the village]]\` links to the same entry but shows different text: [[Thornwick Hollow|the village]]

Links match an entry's name, ignoring capital letters, so \`[[thornwick hollow]]\` works too.

## Picking from a list

While editing, type \`[[\` and BlackQuill lists the entries that match what you type next. Use the arrow keys or the mouse to pick one, and the whole link is filled in for you.

## Linking to entries that do not exist yet

If you are the DM and you click a link to an entry that does not exist yet, BlackQuill creates it for you, ready to fill in. That is a quick way to sketch out a world: write the links first, then click them to make the entries.

## Linking to the SRD

Links also connect to the **SRD** (the D&D 5e System Reference Document) once the DM has loaded it from the **SRD** page in the sidebar.

- Typing \`[[\` lists SRD spells, monsters, items, conditions and more alongside your campaign entries. Picking one inserts a link such as \`[[srd:spells/fireball|Fireball]]\`.
- A plain link such as \`[[Goblin]]\` opens the SRD entry with exactly that name when no campaign entry has it.
- A campaign entry always wins: if you write your own entry called Goblin, \`[[Goblin]]\` opens yours.

For example: [[srd:spells/fireball|Fireball]], [[srd:monsters/goblin|goblin]] and [[srd:conditions/frightened|frightened]]. If the SRD has not been loaded yet, these links open the SRD page, where the DM can import it.

## Try it

This campaign's example village is [[Thornwick Hollow]]. From there you can follow links to [[Old Maren Vosk|the innkeeper]] and to the quest [[The Drowned Bell]].

## Showing a link without making one

Inside backticks, \`[[ ]]\` is shown as typed instead of becoming a link. That is how this card shows the examples above.
`;

const MENUS = `The sections in the sidebar (Atlas, Personae, Quests and the rest) and the subcategories under them are not fixed. The DM can switch them on or off, change their order and add new subcategories, so the ledger fits the way your table plays.

## Where to find it

1. Sign in as the DM.
2. Open **Settings** at the bottom of the sidebar.
3. Choose the **Navigation** tab.

Players do not see this tab.

## What you can change

- **Show or hide a section or subcategory:** tick or untick its box. Hiding a section hides everything under it. Ticking a subcategory turns its section back on.
- **Change the order:** drag a section or subcategory to a new place, or use its **↑** and **↓** buttons. Subcategories move within their own section.
- **Add a subcategory:** pick the section, type a name (for example *Settlement* under Atlas or *Rivals* under Personae) and click **Add**.

Click **Save Navigation** when you are done. The sidebar, and the section lists in **New Entry** and **Edit**, then show only the items that are switched on, in your order.

## Good to know

- Dashboard and All Entries always stay at the top.
- Hiding a section does not delete anything. Its entries stay on disk and come back when you switch it on again.
- The menus are shared by every campaign on this BlackQuill.
`;

// Category and subcategory are menu labels from the default navigation (lib/navigation.js).
const EXAMPLE_NOTES = [
  { title: "Markdown Cheat Sheet", slug: "markdown-cheat-sheet", category: "Codex", subcategory: "Rules Reference", tags: ["example", "help"], content: CHEAT_SHEET },
  { title: "How to Link Entries", slug: "how-to-link-entries", category: "Codex", subcategory: "Rules Reference", tags: ["example", "help"], content: LINKS },
  { title: "Customising the Menus", slug: "customising-the-menus", category: "Codex", subcategory: "Rules Reference", tags: ["example", "help"], content: MENUS },
  { title: "Thornwick Hollow", slug: "thornwick-hollow", category: "Atlas", subcategory: "Village", locationLevel: "Village", tags: ["example", "mirefen"], content: VILLAGE },
  { title: "Old Maren Vosk", slug: "old-maren-vosk", category: "Personae", subcategory: "Party Contacts", tags: ["example", "thornwick-hollow"], parentSlug: "thornwick-hollow", content: INNKEEPER },
  { title: "The Drowned Bell", slug: "the-drowned-bell", category: "Quests", subcategory: "Side Quests", tags: ["example", "thornwick-hollow"], parentSlug: "thornwick-hollow", content: QUEST }
];

function writeExampleNote(note, now) {
  const { content, ...meta } = note;
  const data = normalizeNoteData({
    id: `note-${meta.slug}`,
    visibility: "dm",
    createdBy: "system",
    createdAt: now,
    updatedAt: now,
    parentSlug: "",
    linkedNotes: [],
    backlinks: [],
    images: [],
    ...meta
  });
  const file = getNoteMarkdownPath(EXAMPLE_CAMPAIGN.slug, data);
  ensureDir(path.dirname(file));
  if (!fs.existsSync(file)) fs.writeFileSync(file, matter.stringify(content, data));
}

// True before the first start has written anything about campaigns.
export function isFreshInstall() {
  return !fs.existsSync(PATHS.campaignsFile) && listCampaignFolders().length === 0;
}

export function createExampleCampaign() {
  const now = new Date().toISOString();
  addCampaign({ id: EXAMPLE_CAMPAIGN.slug, ...EXAMPLE_CAMPAIGN, folder: EXAMPLE_CAMPAIGN.slug, createdBy: "system", createdAt: now, example: true });
  for (const note of EXAMPLE_NOTES) writeExampleNote(note, now);
}
