"use client";

import { ArrowUpRight, Check, LinkSimple, LinkedinLogo, XLogo } from "@phosphor-icons/react/ssr";
import { useState } from "react";
import { marketingCopy } from "@/content/marketing-copy";

const { share } = marketingCopy.blog;

/** Copy link plus plain share links: real share URLs in a new tab, no third-party script. */
export function ShareRow({ url, title }: { url: string; title: string }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
    } catch {
      setCopy("failed"); // no clipboard outside a secure context, or permission refused
    }
    setTimeout(() => setCopy("idle"), 3000);
  }

  const links = [
    { label: share.linkedin, Icon: LinkedinLogo, href: `https://www.linkedin.com/sharing/share-offsite/?${new URLSearchParams({ url })}` },
    { label: share.x, Icon: XLogo, href: `https://x.com/intent/post?${new URLSearchParams({ text: title, url })}` },
  ];

  return (
    <div className="post-share">
      <p className="post-share__label">{share.label}</p>
      <button type="button" className="post-share__item" onClick={copyLink}>
        {copy === "copied" ? <Check aria-hidden="true" size={18} weight="light" /> : <LinkSimple aria-hidden="true" size={18} weight="light" />}
        {copy === "copied" ? share.copied : share.copy}
      </button>
      {links.map(({ label, Icon, href }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="post-share__item">
          <Icon aria-hidden="true" size={18} weight="light" />
          {label}
          <span className="sr-only">{share.newTab}</span>
          <ArrowUpRight aria-hidden="true" size={14} weight="light" />
        </a>
      ))}
      <p role="status" className={copy === "failed" ? "lp-caption post-share__note" : "sr-only"}>
        {copy === "copied" ? share.copied : copy === "failed" ? share.failed : ""}
      </p>
    </div>
  );
}
