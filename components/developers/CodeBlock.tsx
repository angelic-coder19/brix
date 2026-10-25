"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** A code sample with a one-click copy button. */
export function CodeBlock({
  code,
  label = "Copy code",
}: {
  code: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="dev-code-wrap">
      <pre className="dev-code" tabIndex={0}>
        <code>{code}</code>
      </pre>
      <button
        type="button"
        className="dev-copy"
        aria-label={copied ? "Copied" : label}
        onClick={async () => {
          if (await copyText(code)) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          }
        }}
      >
        {copied ? (
          <Check size={14} aria-hidden />
        ) : (
          <Copy size={14} aria-hidden />
        )}
        <span>{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}

/** Copy or open the whole page as Markdown, for an LLM or a coding agent. */
export function PageAsMarkdown() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className="dev-ai" role="group" aria-label="Use these docs with AI">
      <button
        type="button"
        className="btn btn--sm"
        onClick={async () => {
          try {
            const md = await (await fetch("/developers.md")).text();
            setState((await copyText(md)) ? "copied" : "failed");
          } catch {
            setState("failed");
          }
          setTimeout(() => setState("idle"), 2000);
        }}
      >
        {state === "copied" ? <Check size={15} /> : <Copy size={15} />}
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Couldn’t copy"
            : "Copy page as Markdown"}
      </button>
      <a className="btn btn--sm btn--ghost" href="/developers.md">
        View as Markdown
      </a>
      <a className="btn btn--sm btn--ghost" href="/llms.txt">
        llms.txt
      </a>
    </div>
  );
}
