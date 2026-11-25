"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ source }: { source: string }) {
  return (
    <div className="prose-ncl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => {
            if (href && href.startsWith("/") && !href.startsWith("//")) {
              const id = href.replace(/^\//, "").split("#")[0];
              if (!id) return <span>{children}</span>;
              return <Link href={`/entry/?id=${encodeURIComponent(id)}`}>{children}</Link>;
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
