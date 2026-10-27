"use client";

import { slugify } from "@devhub/contracts";
import { Field, Input } from "@devhub/ui";
import { useState } from "react";

/** Name + slug pair; the slug follows the name until the user edits it. */
export function SlugFields({
  nameLabel,
  namePlaceholder,
  errors,
  slugPrefix,
}: {
  nameLabel: string;
  namePlaceholder?: string;
  errors?: Record<string, string> | undefined;
  slugPrefix?: string;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={nameLabel} htmlFor="name" error={errors?.name}>
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={namePlaceholder}
          value={name}
          aria-invalid={Boolean(errors?.name)}
          onChange={(e) => {
            setName(e.target.value);
            if (!touched) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field label="Slug" htmlFor="slug" error={errors?.slug} hint={`${slugPrefix ?? ""}${slug || "your-slug"}`}>
        <Input
          id="slug"
          name="slug"
          required
          pattern="[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){1,47}"
          maxLength={48}
          value={slug}
          aria-invalid={Boolean(errors?.slug)}
          className="font-mono text-[13px]"
          onChange={(e) => {
            setTouched(true);
            setSlug(e.target.value.toLowerCase());
          }}
        />
      </Field>
    </div>
  );
}
