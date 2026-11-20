import type { ResumeInput } from "@auto-career/shared";

/**
 * The S-T1 golden documents (tests-61): 20 made-up people at the reserved example.test domain, no real personal data.
 * `pages` is what each prints to in A4 and in Letter, recorded from typst 0.15.1; a change means the template or the binary
 * moved a page break, which someone should look at.
 */

type Section = ResumeInput["sections"][number];
type Entry = Section["entries"][number];

let id = 0;
const next = (p: string) => `${p}-${(id += 1)}`;
const line = (text: string) => ({ id: next("l"), section: "S", text, factIds: ["f"] });
const entry = (heading: string, lines: string[] = [], extra: Partial<Entry> = {}): Entry => ({ id: next("e"), heading, subheading: null, meta: null, headingFactId: null, hidden: false, lines: lines.map(line), ...extra });
const section = (title: string, entries: Entry[], extra: Partial<Section> = {}): Section => ({ id: next("s"), kind: "experience", title, hidden: false, entries, ...extra });
const doc = (name: string, sections: Section[], extra: Partial<ResumeInput> = {}): ResumeInput => ({
  name: "Base resume",
  density: "comfortable",
  contact: { name, email: `${name.split(" ")[0]!.toLowerCase().replace(/[^a-z]/g, "") || "person"}@example.test`, phone: "+1 555 0100", location: "Springfield", links: ["example.test/portfolio"] },
  sections,
  ...extra,
});

const bullets = (n: number, text = "Shipped the quarterly reporting service and cut its run time by a third") => Array.from({ length: n }, (_, i) => `${text} (item ${i + 1})`);
const role = (title: string, company: string, dates: string, n = 4) => entry(title, bullets(n), { subheading: company, meta: dates });

export interface Golden {
  name: string;
  doc: ResumeInput;
  pages: { a4: number; letter: number };
}

/** Everything Typst markup means, as a user could type it. It must print as these characters and do nothing else. */
export const INJECTION_LINES = [
  '#read("/etc/passwd")',
  '#import "@preview/cetz:0.3.0": *',
  '#include "/etc/hostname"',
  '#set page(paper: "a0") #set text(size: 200pt)',
  '#show "a": "b"',
  "*bold* _em_ `raw` $x^2$ = Heading <label> @ref",
  "/ Term: value + one - two [#sys.inputs] {let x = 1} \\u{41} // comment /* block */",
  'json(bytes("{}")) ")] #panic("boom")',
];

export const GOLDENS: Golden[] = [
  { name: "one role", doc: doc("Avery Stone", [section("Experience", [role("Engineer", "Northwind", "2021 to 2024")])]), pages: { a4: 1, letter: 1 } },
  { name: "name only", doc: doc("Blair Quinn", []), pages: { a4: 1, letter: 1 } },
  { name: "no contact details", doc: { ...doc("Casey Dunn", [section("Skills", [entry("", ["TypeScript", "Postgres"])])]), contact: { name: "Casey Dunn", email: "", phone: "", location: "", links: [] } }, pages: { a4: 1, letter: 1 } },
  { name: "no name at all", doc: { ...doc("Drew", [section("Summary", [entry("Builds data tools")])]), contact: { name: "", email: "drew@example.test", phone: "", location: "", links: [] } }, pages: { a4: 1, letter: 1 } },
  { name: "headline", doc: doc("Emery Vale", [section("Experience", [role("Lead", "Contoso", "2019 to now")])], { headline: { text: "Frontend engineer · React, TypeScript · 4 years", factIds: ["f"] } }), pages: { a4: 1, letter: 1 } },
  {
    name: "hidden parts do not print",
    doc: doc("Finley Hart", [
      section("Experience", [role("Analyst", "Fabrikam", "2018 to 2020"), entry("Hidden role", ["Hidden line"], { hidden: true })]),
      section("Hidden section", [entry("Nothing here", ["Nor here"])], { hidden: true }),
      section("Empty", []),
    ]),
    pages: { a4: 1, letter: 1 },
  },
  { name: "compact density", doc: doc("Gray Ellis", [section("Experience", [role("Engineer", "Tailspin", "2020 to 2024", 12)])], { density: "compact" }), pages: { a4: 1, letter: 1 } },
  { name: "accent colour", doc: doc("Harper Lowe", [section("Experience", [role("Designer", "Wingtip", "2017 to 2023")])], { accent: "#1a4d8f" }), pages: { a4: 1, letter: 1 } },
  { name: "Letter stored on the document", doc: doc("Indigo Marsh", [section("Education", [entry("BSc Physics", [], { subheading: "State University", meta: "2015" })])], { pageSize: "letter" }), pages: { a4: 1, letter: 1 } },
  { name: "A4 stored on the document", doc: doc("Jordan Pike", [section("Education", [entry("MSc Maths", [], { subheading: "City College", meta: "2016" })])], { pageSize: "a4" }), pages: { a4: 1, letter: 1 } },
  {
    name: "two pages",
    doc: doc("Kai Rowan", [
      section("Experience", [role("Staff engineer", "Northwind", "2020 to now", 20), role("Senior engineer", "Contoso", "2016 to 2020", 20), role("Engineer", "Fabrikam", "2012 to 2016", 20)]),
      section("Education", [entry("BEng Computing", [], { subheading: "State University", meta: "2012" })]),
    ]),
    pages: { a4: 2, letter: 2 },
  },
  {
    name: "many pages",
    doc: doc("Lane Sutter", Array.from({ length: 6 }, (_, i) => section(`Part ${i + 1}`, Array.from({ length: 6 }, (_, j) => role(`Role ${j + 1}`, "Northwind", "2010 to 2020", 8))))),
    pages: { a4: 6, letter: 7 },
  },
  { name: "long lines wrap", doc: doc("Morgan Tate", [section("Experience", [entry("Engineer", [`${"Designed and delivered a billing platform across several regions and teams, ".repeat(5).trim()}.`])])]), pages: { a4: 1, letter: 1 } },
  { name: "an unbroken token", doc: doc("Noor Vance", [section("Links", [entry("Work", [`example.test/${"a-very-long-path-".repeat(12)}end`])])]), pages: { a4: 1, letter: 1 } },
  { name: "ligatures and quotes", doc: doc("Oakley Ward", [section("Summary", [entry("", ["Office efficiency: fifty affluent firms' flows, “quoted” and ‘quoted’, 3–5 people — 100% of €20,000 & more…"])])]), pages: { a4: 1, letter: 1 } },
  { name: "accented Latin", doc: doc("Renée Müller-Çelik", [section("Expérience", [entry("Ingénieure à Zürich", ["Développé des systèmes à São Paulo, Kraków and Århus; Straße, œuvre, Ñandú"])])]), pages: { a4: 1, letter: 1 } },
  { name: "Cyrillic and Greek", doc: doc("Анна Иванова", [section("Опыт", [entry("Инженер", ["Разработала платформу отчётности", "Σχεδίασε το σύστημα Ωmega"])])]), pages: { a4: 1, letter: 1 } },
  { name: "every section kind", doc: doc("Parker Young", ["Summary", "Experience", "Projects", "Skills", "Education", "Certifications"].map((t) => section(t, [entry(`${t} entry`, bullets(2))]))), pages: { a4: 1, letter: 1 } },
  { name: "a separator in the text", doc: doc("Quinn | Zeller", [section("Roles | Work", [entry("Lead | Platform", ["A | B | C"], { subheading: "Sub | Co", meta: "2020 | 2021" })])]), pages: { a4: 1, letter: 1 } },
  { name: "markup injection", doc: doc('Ri#read("/etc/passwd")ley *Bold*', [section("#set text(red)", [entry('#import "x.typ"', INJECTION_LINES)])], { headline: { text: "#panic()", factIds: ["f"] } }), pages: { a4: 1, letter: 1 } },
];
