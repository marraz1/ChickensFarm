import { requireUser, resolveActiveFarm } from "@/lib/session";
import { FarmSwitcher } from "@/components/layout/farm-switcher";
import { BottomTabBar } from "@/components/layout/bottom-tab-bar";
import { Fab } from "@/components/layout/fab";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { farms, activeFarm } = await resolveActiveFarm(user.id);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        {activeFarm ? (
          <FarmSwitcher farms={farms} activeFarm={activeFarm} />
        ) : (
          <div className="px-4 py-3">
            <span className="text-lg font-medium">ChickensFarm</span>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-md flex-1 pb-24">{children}</main>

      {activeFarm && (
        <>
          <BottomTabBar />
          <Fab />
        </>
      )}
    </div>
  );
}
