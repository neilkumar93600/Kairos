"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { useRef, useState } from "react";
import { Dialog, DialogClose, DialogPortal } from "@/components/ui/dialog";
import { marketingCopy } from "@/content/marketing-copy";
import { NewsletterForm } from "../newsletter/newsletter-form";
import "./popup.css";

const { popup } = marketingCopy;

/**
 * The popup's card. The portal carries .lp, because Base UI mounts in <body>, outside LandingShell, where the type and
 * motion tokens would not resolve. Hence the primitives rather than DialogContent; DialogTitle's own utilities would
 * also beat .lp-h3. Focus lands on the card itself, so screen readers hear the title and no phone keyboard pops. The
 * card never closes itself after a signup.
 */
export function PopupCard({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const card = useRef<HTMLDivElement>(null);
  const [sent, setSent] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal className="lp">
        <DialogPrimitive.Backdrop className="nlp-backdrop" />
        <DialogPrimitive.Popup ref={card} initialFocus={card} className="glass-panel nlp">
          <DialogClose aria-label={popup.close} className="nlp-x">
            <X size={18} weight="light" aria-hidden="true" />
          </DialogClose>
          <div className="lp-art lp-grain nlp-art">
            <Image
              src="/landing/art/step-4-replies.png"
              alt=""
              fill
              sizes="(min-width: 1280px) 480px, (min-width: 768px) 440px, 100vw"
              style={{ objectPosition: "50% 85%" }}
            />
          </div>
          <div className="nlp-body">
            <DialogPrimitive.Title className="lp-h3">{popup.heading}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="lp-body-sm nlp-desc">{popup.body}</DialogPrimitive.Description>
            <NewsletterForm variant="compact" source="popup" onSubscribed={() => setSent(true)} />
            <DialogClose className="lp-link nlp-decline">{sent ? popup.close : popup.decline}</DialogClose>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
