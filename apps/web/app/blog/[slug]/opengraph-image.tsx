import { ImageResponse } from "next/og";

import { formatPostDate, posts } from "../../../src/resources/content";

export const alt = "supastack Blog article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts.find((item) => item.slug === slug);
  const title = post?.title ?? "supastack Blog";
  const meta = post ? `${post.category} · ${formatPostDate(post.date)}` : "supastack Blog";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#050505",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <span style={{ color: "#f5f5f5", fontSize: 34, fontWeight: 700 }}>supastack Blog</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <span style={{ color: "#929292", fontSize: 30 }}>{meta}</span>
        <span
          style={{
            color: "#f5f5f5",
            fontSize: title.length > 60 ? 56 : 68,
            fontWeight: 700,
            lineHeight: 1.15,
          }}
        >
          {title}
        </span>
      </div>
      <span style={{ color: "#929292", fontSize: 28 }}>Example articles for your application.</span>
    </div>,
    size,
  );
}
