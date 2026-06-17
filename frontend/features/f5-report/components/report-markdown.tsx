// features/f5-report/components/report-markdown.tsx
// react-markdown + KaTeX(remark-math/rehype-katex) + GFM(표) 렌더러.
// 빌드 프롬프트: 응답 report(마크다운)를 수식 지원으로 렌더(7섹션 본문).
"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import styles from "./report-markdown.module.css";

export function ReportMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className={styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
