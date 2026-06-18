// tailwind.config.ts — Lab Paper (design-system.md §2.2 와 1:1)
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)", // #f6f5f1
        card: "var(--card)", // #fbfbf9
        inset: "var(--inset)", // #f0efe9
        ink: {
          DEFAULT: "var(--ink)", // #1b1b1a
          soft: "var(--ink-soft)", // #54524c
          faint: "var(--ink-faint)", // #6f6d66
        },
        hairline: {
          DEFAULT: "var(--hairline)", // #d8d6cd
          2: "var(--hairline-2)", // #cac8be
          soft: "var(--hairline-soft)", // #e6e4dd
        },
        accent: {
          DEFAULT: "var(--accent)", // #36367a
          ink: "var(--accent-ink)", // #2a2a63
          wash: "var(--accent-wash)", // #ececf4
          edge: "var(--accent-edge)", // #c9c9e0
        },
        ok: {
          DEFAULT: "var(--ok)", // #3a5f3a
          wash: "var(--ok-wash)", // #e8efe7
        },
        oxblood: {
          DEFAULT: "var(--oxblood)", // #7a2e2e
          wash: "var(--oxblood-wash)", // #f3e7e5
        },
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "Fraunces", "Georgia", "Noto Serif KR", "serif"], // 헤딩
        sans: [
          "var(--font-inter)",
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Malgun Gothic",
          "Apple SD Gothic Neo",
          "sans-serif",
        ], // 본문/UI
        mono: [
          "var(--font-jetbrains)",
          "JetBrains Mono",
          "ui-monospace",
          "Cascadia Mono",
          "Consolas",
          "monospace",
        ], // 수치
      },
      fontSize: {
        meta: ["10px", { letterSpacing: "0.08em" }], // 라벨/세션/뱃지 메타
        label: ["11px", { letterSpacing: "0.10em" }], // rail-heading, field label (uppercase)
        sm: "12px", // 보조 텍스트, 칩, 세그
        base: "13px", // 본문/컨트롤/버튼
        title: "17px", // card-head h2 (serif)
        brand: "19px", // brand-name (serif)
        h1: "26px", // work-head h1 (serif)
      },
      spacing: {
        s1: "4px",
        s2: "8px",
        s3: "12px",
        s4: "16px",
        s6: "24px",
        s8: "32px",
      },
      borderRadius: {
        sm: "var(--r-sm)", // 5px
        md: "var(--r-md)", // 8px
        lg: "var(--r-lg)", // 12px
        pill: "var(--r-pill)", // 999px
      },
      boxShadow: {
        card: "0 1px 2px rgba(27,27,26,.04)",
        "card-sm": "0 1px 2px rgba(27,27,26,.05)",
        "ai-plan": "0 2px 10px rgba(54,54,122,.10)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)", // 패널 grid-template 트랜지션
      },
    },
  },
  plugins: [],
};

export default config;
