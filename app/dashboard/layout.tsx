import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/db/user";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
