import type { Metadata } from "next";
import { BlogIndex } from "../../src/resources/resource-pages";
import { categories, filterPosts } from "../../src/resources/content";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog",
  description:
    "Engineering notes, architectural decisions, and practical guides for building with supastack.",
  alternates: { canonical: "/blog" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ category?: string | string[] }>;
}) {
  const value = (await searchParams).category;
  const category = typeof value === "string" && categories.includes(value) ? value : "All articles";
  return <BlogIndex posts={filterPosts(category)} category={category} />;
}
