"use client";

import { httpUrl } from "@auto-career/shared";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useProfile } from "@/hooks/use-profile";
import { contactOf } from "./contact";
import { SectionAlert, TextField, useSection, type Errors, type SectionProps } from "./kit";

const LINKS = [
  { key: "linkedinUrl", label: "LinkedIn", placeholder: "linkedin.com/in/your-name" },
  { key: "githubUrl", label: "GitHub", placeholder: "github.com/your-name" },
  { key: "portfolioUrl", label: "Portfolio or website", placeholder: "your-site.com" },
] as const;
type Links = Record<(typeof LINKS)[number]["key"], string>;

/** "linkedin.com/in/x" becomes "https://linkedin.com/in/x": the server takes http(s) links only. */
const withScheme = (v: string) => {
  const t = v.trim();
  return !t || /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

/** LinkedIn, GitHub and a portfolio, through PUT /profile/contact. */
export function LinksSection({ bind }: SectionProps) {
  const profile = useProfile();
  const { saveContact } = useOnboarding();
  const s = useSection<Links>({
    name: "links",
    bind,
    initial: () => ({ linkedinUrl: profile.data?.linkedinUrl ?? "", githubUrl: profile.data?.githubUrl ?? "", portfolioUrl: profile.data?.portfolioUrl ?? "" }),
    validate: (v) => {
      const errors: Errors = {};
      for (const { key } of LINKS) {
        const url = withScheme(v[key]);
        // Browsers' URL parser takes a space in the host ("https://not%20a%20link"); the server's (Node) refuses it.
        if (url && (/\s/.test(url) || !httpUrl(300).safeParse(url).success)) errors[`ob-${key}`] = "Enter a full link, for example https://your-site.com.";
      }
      return errors;
    },
    save: async (v, track) => {
      const links = { linkedinUrl: withScheme(v.linkedinUrl), githubUrl: withScheme(v.githubUrl), portfolioUrl: withScheme(v.portfolioUrl) };
      await saveContact.mutateAsync({ ...contactOf(profile.data), linkedinUrl: links.linkedinUrl || null, githubUrl: links.githubUrl || null, portfolioUrl: links.portfolioUrl || null });
      track.value = links;
    },
  });
  return (
    <div className="ob-fields">
      {LINKS.map(({ key, label, placeholder }) => (
        <TextField
          key={key}
          {...s.field(`ob-${key}`)}
          wide
          label={label}
          type="url"
          inputMode="url"
          autoComplete="url"
          maxLength={300}
          placeholder={placeholder}
          value={s.value[key]}
          onChange={(x) => s.set({ ...s.value, [key]: x })}
        />
      ))}
      <SectionAlert message={s.alert} />
    </div>
  );
}
