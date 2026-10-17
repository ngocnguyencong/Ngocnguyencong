"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { updateNotificationPreferencesForRequest } from "./notification-service";

export async function updateNotificationPreferencesAction(formData: FormData) {
  const patch = {
    emailInvites: formData.get("emailInvites") === "on",
    emailBilling: formData.get("emailBilling") === "on",
    inAppProduct: formData.get("inAppProduct") === "on",
  };
  const result = await updateNotificationPreferencesForRequest(await headers(), patch);
  if (!result.ok) {
    redirect("/settings/notifications?status=unauthorized");
  }
  redirect("/settings/notifications?status=saved");
}
