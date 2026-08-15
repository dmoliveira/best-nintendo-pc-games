import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSiteConfig } from "@/lib/site-config";
import { getGenreHub, getGenreHubs, getCatalogSearchRecords } from "@/lib/catalog/site-data";
import TaxonomyHub from "@/app/taxonomy-hub";

type GenrePageProps = { params: Promise<{ id: string }> };
const site = createSiteConfig(process.env);

export const dynamicParams = false;

export function generateStaticParams() {
  return getGenreHubs().map((genre) => ({ id: genre.id }));
}

export async function generateMetadata({ params }: GenrePageProps): Promise<Metadata> {
  const { id } = await params;
  const genre = getGenreHub(id);
  if (!genre) return {};
  const url = site.publicUrl(`genres/${genre.id}/`);
  return { title: `Best ${genre.name} Games`, description: genre.description, alternates: { canonical: url }, openGraph: { type: "website", title: `Best ${genre.name} Games | GameAtlas`, description: genre.description, url } };
}

export default async function GenrePage({ params }: GenrePageProps) {
  const { id } = await params;
  const genre = getGenreHub(id);
  if (!genre) notFound();
  const records = getCatalogSearchRecords().filter((record) => record.genreIds.includes(genre.id));
  return <TaxonomyHub eyebrow="Genre guide" title={genre.name} description={genre.description} records={records} backLabel="Genre collection" visual={{ kind: "genre", genreId: genre.id }} />;
}
