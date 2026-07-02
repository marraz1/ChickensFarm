import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listFarmsForUser } from "@/lib/services/farms";
import type { FarmRole } from "@/generated/prisma/client";

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

// For route handlers: throws instead of redirecting, so callers can return a 401 JSON response.
export async function requireUserApi() {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Not authenticated");
  return session.user;
}

// Same access check as requireFarmAccess, but throws instead of calling notFound(),
// for use in route handlers (API) which need a 403 JSON response rather than a 404 page.
export async function requireFarmAccessApi(farmId: string, opts?: { minRole?: FarmRole }) {
  const session = await auth();
  if (!session?.user?.id) throw new ForbiddenError("Not authenticated");
  const user = session.user;

  const farm = await prisma.farm.findFirst({
    where: {
      id: farmId,
      deletedAt: null,
      farmUsers: {
        some: {
          userId: user.id,
          ...(opts?.minRole ? { role: opts.minRole } : {}),
        },
      },
    },
  });
  if (!farm) throw new ForbiddenError("No access to this farm");
  return { user, farm };
}

export async function requireFarmAccess(farmId: string, opts?: { minRole?: FarmRole }) {
  const user = await requireUser();

  const farm = await prisma.farm.findFirst({
    where: {
      id: farmId,
      deletedAt: null,
      farmUsers: {
        some: {
          userId: user.id,
          ...(opts?.minRole ? { role: opts.minRole } : {}),
        },
      },
    },
  });
  if (!farm) notFound();
  return { user, farm };
}

const ACTIVE_FARM_COOKIE = "activeFarmId";

export async function getActiveFarmId() {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return store.get(ACTIVE_FARM_COOKIE)?.value ?? null;
}

export async function setActiveFarmId(farmId: string) {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  store.set(ACTIVE_FARM_COOKIE, farmId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export { ACTIVE_FARM_COOKIE };

// Resolves which farm is "active" for the current user: the cookie-selected one if
// it's still in their farm list, otherwise their first farm, otherwise none.
export async function resolveActiveFarm(userId: string) {
  const farms = await listFarmsForUser(userId);
  if (farms.length === 0) return { farms, activeFarm: null };
  const cookieId = await getActiveFarmId();
  const activeFarm = farms.find((f) => f.id === cookieId) ?? farms[0];
  return { farms, activeFarm };
}

// For Server Components / Server Actions: redirects to farm creation if the user has no farm yet.
export async function requireActiveFarm() {
  const user = await requireUser();
  const { farms, activeFarm } = await resolveActiveFarm(user.id);
  if (!activeFarm) redirect("/farms/new");
  return { user, farm: activeFarm, farms };
}

// For route handlers: throws instead of redirecting.
export async function requireActiveFarmApi() {
  const user = await requireUserApi();
  const { activeFarm } = await resolveActiveFarm(user.id);
  if (!activeFarm) throw new ForbiddenError("No active farm");
  return { user, farm: activeFarm };
}
