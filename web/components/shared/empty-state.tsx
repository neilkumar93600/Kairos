import type { Icon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useId, type ReactNode } from "react";
import type { PostFan } from "@/content/blog-meta";
import { cn } from "@/lib/utils";
import "./empty-state.css";

/** The one phrase of an empty state's title set in full Ink; the rest of the title is Deep Ash. */
export function EmptyEm({ children }: { children: ReactNode }) {
  return <span className="text-ink">{children}</span>;
}

/**
 * Designed empty state: what is missing, why, and the next action. Centred. The boxed form is a Bone panel framed by four
 * dashed guide lines that run past its corners; `flat` drops the frame for use inside a Panel, so it never reads as a card
 * in a card. `icon` is an optional Phosphor glyph in a circle; `large` draws it at 40px in a 72px circle, for line
 * illustrations. `fan` adds three real links to blog posts, boxed form only. The title is a paragraph, not a heading, so
 * it never breaks heading order wherever it is placed.
 */
export function EmptyState({
  title,
  body,
  action,
  icon: IconComponent,
  flat,
  large,
  fan,
}: {
  title: ReactNode;
  body: string;
  action?: ReactNode;
  icon?: Icon;
  flat?: boolean;
  large?: boolean;
  fan?: PostFan;
}) {
  return (
    <div
      className={cn(
        "es flex flex-col items-center gap-4 text-center",
        flat ? "py-2" : "es--frame gap-5 bg-sunk px-5 py-12 sm:px-8 sm:py-16",
      )}
    >
      {flat ? null : (
        <>
          <span aria-hidden className="es-guide es-guide--x es-guide--top" />
          <span aria-hidden className="es-guide es-guide--x es-guide--bottom" />
          <span aria-hidden className="es-guide es-guide--y es-guide--left" />
          <span aria-hidden className="es-guide es-guide--y es-guide--right" />
        </>
      )}
      {IconComponent ? (
        <span
          aria-hidden
          className={cn("flex items-center justify-center rounded-pill text-icon", large ? "size-18" : "size-12", flat ? "bg-sunk" : "bg-surface")}
        >
          <IconComponent size={large ? 40 : 24} weight="light" />
        </span>
      ) : null}
      <div className="flex flex-col items-center gap-2">
        <p className={cn("font-medium tracking-[-0.015em] text-balance text-faint", flat ? "text-lg" : "text-2xl")}>{title}</p>
        <p className="max-w-[52ch] text-base leading-relaxed text-balance text-body">{body}</p>
      </div>
      {action ? <div className="es-actions flex w-full flex-col items-stretch justify-center gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center">{action}</div> : null}
      {fan && !flat ? <Fan {...fan} /> : null}
    </div>
  );
}

/** Three overlapping cards where there is room, a plain list of rows where there is not. Static in the app: see empty-state.css. */
function Fan({ caption, posts }: PostFan) {
  const id = useId();
  return (
    <div className="es-fan-box">
      <p id={id} className="text-sm text-faint">
        {caption}
      </p>
      <ul aria-labelledby={id} className="es-fan">
        {posts.map((post) => (
          <li key={post.slug} className="es-fan__item">
            <Link href={`/blog/${post.slug}`} className="es-card">
              <span className="es-card__art">
                <Image src={post.image.src} alt="" fill sizes="220px" style={{ objectPosition: post.image.position }} />
              </span>
              <span className="es-card__title">{post.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
