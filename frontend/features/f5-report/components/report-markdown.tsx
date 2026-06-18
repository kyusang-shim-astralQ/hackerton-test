"use client";
// features/f5-report/components/report-markdown.tsx — 리포트 마크다운 렌더 (react-markdown + KaTeX + GFM)
// 수식($..$/$$..$$), 표, blockquote `> [!NOTE]` admonition 지원. Lab Paper 토큰만 사용.
import React, { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// GitHub admonition (`> [!NOTE]` 등)을 Lab Paper 톤 카드로 변환.
const ADMONITION_RE = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i;

const components: Components = {
  h1: ({ children }) => (
    <h1 className="font-serif text-h1 font-medium text-ink leading-tight mt-s6 first:mt-0 mb-s3">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="font-serif text-title font-medium text-ink leading-tight mt-s6 mb-s2 pb-s1 border-b border-hairline-soft">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="font-serif text-base font-semibold text-ink mt-s4 mb-s2">{children}</h3>
  ),
  p: ({ children }) => <p className="text-sm text-ink-soft leading-relaxed my-s2">{children}</p>,
  ul: ({ children }) => (
    <ul className="list-disc pl-s6 text-sm text-ink-soft my-s2 space-y-s1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-s6 text-sm text-ink-soft my-s2 space-y-s1">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-ink">{children}</strong>,
  a: ({ children, href }) => (
    <a href={href} className="text-accent underline underline-offset-2 hover:text-accent-ink">
      {children}
    </a>
  ),
  code: ({ className, children }) => {
    const isBlock = (className ?? "").includes("language-");
    if (isBlock) {
      return (
        <code className="mono text-[12px] text-ink whitespace-pre">{children}</code>
      );
    }
    return (
      <code className="mono text-[12px] bg-inset text-accent-ink rounded-sm px-s1 py-[1px]">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-inset border border-hairline-soft rounded-md p-s3 my-s3 overflow-x-auto">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-s4 overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead>{children}</thead>,
  th: ({ children }) => (
    <th className="text-meta uppercase tracking-[0.06em] text-ink-faint font-semibold text-left py-s2 px-s3 border-b border-hairline">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="py-s2 px-s3 border-b border-hairline-soft text-ink-soft align-top">{children}</td>
  ),
  blockquote: ({ children }) => {
    // admonition 라벨 추출 (`> [!NOTE]`)
    let label: string | null = null;
    const mapped = React.Children.map(children, (child) => {
      if (
        React.isValidElement(child) &&
        child.type === "p" &&
        typeof (child.props as { children?: unknown }).children === "string"
      ) {
        const text = (child.props as { children: string }).children;
        const m = text.match(ADMONITION_RE);
        if (m) {
          label = m[1].toUpperCase();
          const rest = text.replace(ADMONITION_RE, "");
          return <p>{rest}</p>;
        }
      }
      return child;
    });
    return (
      <div className="my-s4 rounded-md border border-accent-edge bg-accent-wash px-s4 py-s3">
        {label ? (
          <div className="text-meta uppercase tracking-[0.08em] text-accent-ink font-semibold mb-s1">
            {label}
          </div>
        ) : null}
        <div className="text-sm text-ink-soft [&>p]:my-s1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0">
          {mapped}
        </div>
      </div>
    );
  },
  hr: () => <hr className="my-s4 border-0 border-t border-hairline-soft" />,
};

export function ReportMarkdown({ markdown }: { markdown: string }) {
  // remark/rehype 플러그인 배열은 안정 참조로 (재렌더 최소화)
  const remarkPlugins = useMemo(() => [remarkMath, remarkGfm], []);
  const rehypePlugins = useMemo(() => [rehypeKatex], []);
  return (
    <div className="report-prose">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
