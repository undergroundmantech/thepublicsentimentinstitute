"use client";
// The site's Link. Next prefetches every visible link by default, so a race list or the navbar fires dozens of
// background requests on every page view, most for pages nobody opens. This keeps navigation quick by prefetching
// only on intent: when the pointer rests on a link, it gets focus, or a finger touches it.
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof NextLink>;

export default function Link({ prefetch, onMouseEnter, onFocus, onTouchStart, ...rest }: Props) {
  const router = useRouter();
  const href = typeof rest.href === "string" ? rest.href : null;
  const warm = () => {
    if (prefetch === false || !href || !href.startsWith("/")) return;
    try { router.prefetch(href); } catch { /* prefetch is a hint */ }
  };
  return (
    <NextLink
      {...rest}
      prefetch={prefetch === true ? true : false}
      onMouseEnter={(e) => { warm(); onMouseEnter?.(e); }}
      onFocus={(e) => { warm(); onFocus?.(e); }}
      onTouchStart={(e) => { warm(); onTouchStart?.(e); }}
    />
  );
}
