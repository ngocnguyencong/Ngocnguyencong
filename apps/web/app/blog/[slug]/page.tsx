import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getRequestBrand } from "../../../src/custom-domains/runtime";
import { pageSocialMetadata } from "../../../src/marketing/seo";
import { posts } from "../../../src/resources/content";
import { BlogArticle } from "../../../src/resources/resource-pages";

export const dynamic = "force-dynamic";
export function generateStaticParams() {
  return posts.map((post) => ({ slug: post.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((item) => item.slug === slug);
  if (!post) return { title: "Article not found" };
  const brand = await getRequestBrand();
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    ...pageSocialMetadata({
      siteName: brand.name,
      type: "article",
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.date,
    }),
  };
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = posts.find((item) => item.slug === slug);
  if (!post) notFound();
  return <BlogArticle post={post} related={posts.filter((item) => item.slug !== slug)} />;
}
