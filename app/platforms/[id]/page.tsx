import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSiteConfig } from "@/lib/site-config";
import { getPlatformHub, getPlatformHubs, getCatalogSearchRecords } from "@/lib/catalog/site-data";
import TaxonomyHub from "@/app/taxonomy-hub";

type PlatformPageProps = { params: Promise<{ id: string }> };
const site = createSiteConfig(process.env);

export const dynamicParams = false;

export function generateStaticParams() {
  return getPlatformHubs().map((platform) => ({ id: platform.id }));
}

export async function generateMetadata({ params }: PlatformPageProps): Promise<Metadata> {
  const { id } = await params;
  const platform = getPlatformHub(id);
  if (!platform) return {};
  const url = site.publicUrl(`platforms/${platform.id}/`);
  return { title: `Best ${platform.name} Games`, description: platform.description, alternates: { canonical: url }, openGraph: { type: "website", title: `Best ${platform.name} Games | GameAtlas`, description: platform.description, url } };
}

export default async function PlatformPage({ params }: PlatformPageProps) {
  const { id } = await params;
  const platform = getPlatformHub(id);
  if (!platform) notFound();
  const records = getCatalogSearchRecords().filter((record) => record.platformIds.includes(platform.id));
  return <TaxonomyHub eyebrow={`${platform.family === "pc" ? "PC" : "Nintendo"} platform guide`} title={platform.name} description={platform.description} records={records} backLabel={`${platform.generation ?? "Platform"} collection`} />;
}
