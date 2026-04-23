import { AppShell } from "@/features/layout/components/app-shell";

export default function Home() {
  return <AppShell e2eEnabled={process.env.E2E_TEST_MODE === "1"} />;
}
