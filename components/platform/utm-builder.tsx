"use client";

import { useMemo, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { CopyButton } from "@/components/admin/copy-button";

const SOURCES = ["instagram", "facebook", "whatsapp", "tiktok", "google", "influenciadora", "panfleto", "email"];

/** Monta links de campanha (utm_*) para saber de onde vem cada interessado. */
export function UtmBuilder({ siteUrl }: { siteUrl: string }) {
  const [source, setSource] = useState("instagram");
  const [medium, setMedium] = useState("social");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const link = useMemo(() => {
    const slug = (v: string) => v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const url = new URL(siteUrl);
    url.searchParams.set("utm_source", slug(source) || "outro");
    url.searchParams.set("utm_medium", slug(medium) || "social");
    if (slug(campaign)) url.searchParams.set("utm_campaign", slug(campaign));
    if (slug(content)) url.searchParams.set("utm_content", slug(content));
    return url.toString();
  }, [siteUrl, source, medium, campaign, content]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Onde vai postar" htmlFor="utm-s">
          <Select id="utm-s" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="utm-m">
          <Select id="utm-m" value={medium} onChange={(e) => setMedium(e.target.value)}>
            <option value="social">post orgânico</option>
            <option value="pago">anúncio pago</option>
            <option value="bio">link da bio</option>
            <option value="story">story</option>
            <option value="parceria">parceria</option>
            <option value="impresso">impresso / QR</option>
          </Select>
        </Field>
        <Field label="Campanha" htmlFor="utm-c" hint="ex.: dia-das-maes">
          <Input id="utm-c" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
        </Field>
        <Field label="Variação" htmlFor="utm-v" optional hint="ex.: video-vovo">
          <Input id="utm-v" value={content} onChange={(e) => setContent(e.target.value)} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-cream px-3 py-2">
        <code className="min-w-0 flex-1 text-xs break-all">{link}</code>
        <CopyButton text={link} label="Copiar link" />
      </div>
    </div>
  );
}
