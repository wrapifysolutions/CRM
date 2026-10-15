import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { getUnreadCount } from "@/actions/dashboard";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  if (profile.role === "client") {
    redirect("/portal");
  }

  const unreadCount = await getUnreadCount(profile.id).catch(() => 0);

  return (
    <div className="flex min-h-dvh overflow-x-clip bg-background">
      <Sidebar
        role={profile.role}
        fullName={profile.full_name}
        unreadCount={unreadCount}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header profile={profile} unreadCount={unreadCount} />
        <main className="app-main flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1320px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
