// app/page.tsx — / → /step-1 리다이렉트
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/step-1");
}
