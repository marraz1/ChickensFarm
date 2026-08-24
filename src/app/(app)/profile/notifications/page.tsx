import { requireUser } from "@/lib/session";
import { getNotificationSetting } from "@/lib/services/notifications";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationSettingsForm } from "@/components/forms/notification-settings-form";
import { formatRelativeLT } from "@/lib/format";

export default async function NotificationSettingsPage() {
  const user = await requireUser();
  const setting = await getNotificationSetting(user.id);

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
                  timeZone: setting.timeZone,
                  channel: setting.channel,
                }
              : undefined
          }
          lastSentAt={setting?.lastSentAt ? formatRelativeLT(setting.lastSentAt) : null}
        />
      </div>
    </div>
  );
}
