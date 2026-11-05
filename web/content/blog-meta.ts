// What a list needs to show a post: no article text, so client components can import this without carrying six articles.
// The words live in blog-posts.ts. Paintings are the owner's own (docs/DESIGN.md "Inner pages"); one per post, chosen for its object.
// Banned characters (house style): em dash, en dash.

export interface PostImage {
  src: string;
  /** object-position of the crop, so the painting's object stays in frame at every ratio. */
  position: string;
  /** Used where the painting stands alone. Lists use an empty alt, because the title beside it says what the link is. */
  alt: string;
}

export interface PostMeta {
  slug: string;
  title: string;
  summary: string;
  date: string;
  category: string;
  image: PostImage;
}

/** Newest first. */
export const postMeta: PostMeta[] = [
  {
    slug: "what-a-credit-pays-for",
    title: "What a Kairos credit pays for, and when it is not spent",
    summary:
      "A credit is spent when an application is reported submitted, and only then. Failed sends, drafts, edits and fit scoring cost none. Approval also reserves credits.",
    date: "2026-11-05",
    category: "How it works",
    image: {
      src: "/landing/art/step-4-replies.png",
      position: "74% 50%",
      alt: "A wooden mailbox stands by a path at sunset, with two small stacks of letters at its foot.",
    },
  },
  {
    slug: "us-roles-from-india-location-and-sponsorship-rules",
    title: "Applying to US roles from India: the rules that matter",
    summary:
      "Location is a text match, there is no country or time zone setting, and sponsorship is a phrase filter. How to set them and read a fit score.",
    date: "2026-11-05",
    category: "Visas",
    image: {
      src: "/landing/art/scene-b-footbridge.png",
      position: "50% 62%",
      alt: "A wooden footbridge crosses a wide river, joining the path on one bank to the meadow on the other.",
    },
  },
  {
    slug: "setting-search-rules-after-a-layoff",
    title: "Setting your search rules after a layoff",
    summary:
      "Role matching, seniority, salary floor and keywords work in specific ways. Know them before you trust the queue, and learn to read a set-aside reason.",
    date: "2026-11-05",
    category: "Job search",
    image: {
      src: "/landing/art/scene-a-dawn-valley.png",
      position: "50% 60%",
      alt: "A footpath runs through a meadow at sunrise towards a small open door by the river.",
    },
  },
  {
    slug: "opt-job-search-sponsorship-filter",
    title: "OPT job search: what the sponsorship filter skips",
    summary:
      "Set your work authorization to OPT or STEM OPT and Kairos skips postings that say they will not sponsor. It reads wording only and is not immigration advice.",
    date: "2026-11-05",
    category: "Visas",
    image: {
      src: "/landing/art/step-1-fit-gate.png",
      position: "68% 60%",
      alt: "Sheets of paper lie across a meadow beside a path, and only a few have passed through the wooden gate.",
    },
  },
  {
    slug: "why-we-cap-applications-per-company",
    title: "Why we cap applications per company",
    summary:
      "By default Kairos allows two applications to one company in any 30 days. You can raise it to five. How the count works, and why the default is low.",
    date: "2026-10-13",
    category: "How it works",
    image: {
      src: "/landing/art/scene-c-noon-meadow.png",
      position: "80% 82%",
      alt: "A small stack of receipts rests on a stone in a sunlit meadow, held down by a pebble.",
    },
  },
  {
    slug: "how-the-truth-lock-works",
    title: "How the truth lock works",
    summary:
      "Every tailored resume line must cite a fact you confirmed. Lines the model writes that fail are left out, and a failing edit is flagged and cannot be saved.",
    date: "2026-10-13",
    category: "How it works",
    image: {
      src: "/landing/art/step-2-truth-lock.png",
      position: "78% 78%",
      alt: "A wooden writing desk stands in a meadow with one page, a few pinned notes and a pen laid out on it.",
    },
  },
];
