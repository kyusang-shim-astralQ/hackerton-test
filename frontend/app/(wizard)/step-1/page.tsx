"use client";
// app/(wizard)/step-1/page.tsx — 1단계 구조 입력 및 검증 (f1-structure)
// 화면 조립은 features/f1-structure 가 소유. 셸(work-head/nav)·우측 요약 패널은 공유 골격이 처리.
import { StructureStep } from "@/features/f1-structure/components/structure-step";

export default function Step1Page() {
  return <StructureStep />;
}
