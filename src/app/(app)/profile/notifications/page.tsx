import { requireUser } from "@/lib/session";
import { getNotificationSetting, getNotificationStatus } from "@/lib/services/notifications";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationSettingsForm } from "@/components/forms/notification-settings-form";
import { formatRelativeLT, formatZonedDateTimeLT } from "@/lib/format";
import { pushPublicKey } from "@/lib/push";

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const [setting, status] = await Promise.all([
    getNotificationSetting(user.id),
    getNotificationStatus(user.id),
  ]);

  return (
    <div>
      <PageHeader title="Pranešimai" backHref="/profile" />
      <div className="flex flex-col gap-6 px-4">
        <NotificationSettingsForm
          // No row until the first save — the form falls back to its defaults.
          defaultValues={
            setting
              ? {
                  enabled: setting.enabled,
                  message: setting.message,
                  sendTime: setting.sendTime,
                  email: setting.email ?? "",
                  timeZone: setting.timeZone,
                  emailEnabled: setting.emailEnabled,
                  pushEnabled: setting.pushEnabled,
                }
              : undefined
          }
          // Dates are formatted here rather than in the client component so the
          // next-send instant is rendered in the user's stored zone, not in
          // whatever zone the device happens to be in right now.
          status={{
            reason: status.reason,
            lastSentAt: status.lastSentAt ? formatRelativeLT(status.lastSentAt) : null,
            nextSendAt: status.nextSendAt
              ? formatZonedDateTimeLT(status.nextSendAt, status.timeZone)
              : null,
          }}
          accountEmail={user.email ?? undefined}
          // Read per request on the server, so the key never becomes a
          // NEXT_PUBLIC_ variable baked into the client bundle at build time.
          vapidPublicKey={pushPublicKey()}
        />
      </div>
    </div>
  );
}
