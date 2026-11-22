import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const lastModified = new Date();
  return [
    { url: `${siteUrl}/`, lastModified, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl}/docs`, lastModified, changeFrequency: "weekly", priority: 0.95 },
    { url: `${siteUrl}/leaderboard`, lastModified, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/signals`, lastModified, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/security`, lastModified, changeFrequency: "weekly", priority: 0.85 },
    { url: `${siteUrl}/about`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/contact`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
