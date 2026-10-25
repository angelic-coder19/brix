"use client";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { BrixMark } from "@/components/brand/BrixMark";
import { CARD_DESIGNS, type CardDesign } from "@/lib/types";

const TEMPLATES = [
  {
    id: "trial",
    label: "Free trial",
    purpose: "Free trial",
    limit: "1.00",
    hint: "A $1 limit passes the sign-up check, so the trial can’t bill you later.",
  },
  {
    id: "month",
    label: "One month",
    purpose: "One month of streaming",
    limit: "15.00",
    hint: "Covers one month. Next month’s charge is declined.",
  },
  {
    id: "order",
    label: "Online order",
    purpose: "Online order",
    limit: "50.00",
    hint: "For a store you don’t want to keep your real card.",
  },
  {
    id: "custom",
    label: "Custom",
    purpose: "",
    limit: "",
    hint: "Name it and set any limit up to $500.",
  },
] as const;

export const DESIGN_LABEL: Record<CardDesign, string> = {
  graphite: "Graphite",
  clay: "Clay",
  cobalt: "Cobalt",
};

/**
 * The new-card form is the card itself: pick a template, type on the card
 * face, choose a colour, then review. Brix still asks for a yes before it
 * creates anything.
 */
export function CardStudio({
  busy,
  onCreate,
}: {
  busy: boolean;
  onCreate: (card: {
    purpose: string;
    spendLimit: number;
    design: CardDesign;
  }) => Promise<void>;
}) {
  const [template, setTemplate] =
    useState<(typeof TEMPLATES)[number]["id"]>("trial");
  const [purpose, setPurpose] = useState<string>(TEMPLATES[0].purpose);
  const [limit, setLimit] = useState<string>(TEMPLATES[0].limit);
  const [design, setDesign] = useState<CardDesign>("graphite");
  const hint = TEMPLATES.find((t) => t.id === template)?.hint;

  return (
    <section className="card studio" aria-labelledby="new-card-title">
      <div className="studio__head">
        <h2 id="new-card-title">New one-time card</h2>
        <p>Type on the card. Brix asks you to confirm before creating it.</p>
      </div>
      <div className="studio__templates" role="group" aria-label="Card templates">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="studio-chip"
            aria-pressed={template === t.id}
            onClick={() => {
              setTemplate(t.id);
              setPurpose(t.purpose);
              setLimit(t.limit);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <form
        className="studio__form"
        onSubmit={(e) => {
          e.preventDefault();
          void onCreate({
            purpose: purpose.trim(),
            spendLimit: Number(limit),
            design,
          });
        }}
      >
        <div className={`vcard vcard--${design} vcard--editing`}>
          <div className="vcard__face">
            <div className="vcard__top">
              <span className="vcard__brand" aria-hidden>
                <BrixMark className="vcard__mark" />
                brix<span className="brand-period">.</span>
              </span>
              <span className="vcard__type" aria-hidden>
                Virtual · Single use
              </span>
            </div>
            <span className="vcard__chip" aria-hidden />
            <p className="vcard__number" aria-hidden>
              <span>••••</span>
              <span>••••</span>
              <span>••••</span>
              <span>new</span>
            </p>
            <div className="vcard__bottom">
              <label className="vcard__edit">
                <small>For</small>
                <input
                  name="purpose"
                  aria-label="What’s it for?"
                  required
                  maxLength={80}
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value);
                    setTemplate("custom");
                  }}
                  placeholder="e.g. Notion AI trial"
                />
              </label>
            </div>
            <label className="vcard__limit vcard__limit--edit">
              <span aria-hidden>Limit $</span>
              <input
                name="spendLimit"
                aria-label="Spending limit (USD)"
                required
                type="number"
                inputMode="decimal"
                min="0.01"
                max="500"
                step="0.01"
                value={limit}
                onChange={(e) => {
                  setLimit(e.target.value);
                  setTemplate("custom");
                }}
                placeholder="10.00"
              />
            </label>
          </div>
        </div>
        <p className="studio__hint">{hint}</p>
        <div className="studio__foot">
          <div
            className="studio__swatches"
            role="group"
            aria-label="Card color"
          >
            {CARD_DESIGNS.map((d) => (
              <button
                key={d}
                type="button"
                className={`swatch swatch--${d}`}
                aria-label={`${DESIGN_LABEL[d]} card`}
                aria-pressed={design === d}
                onClick={() => setDesign(d)}
              />
            ))}
          </div>
          <button className="btn btn--primary" disabled={busy}>
            Review card <ArrowRight size={17} />
          </button>
        </div>
      </form>
      <small className="studio__note">
        Sandbox only. These cards cannot spend real money.
      </small>
    </section>
  );
}
