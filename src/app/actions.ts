"use server";

import { revalidatePath } from "next/cache";
import { updateTargetStatus, updateTargetRead, STATUSES, type TargetStatus } from "@/lib/targets";

export async function setTargetStatus(id: string, status: string) {
  if (!STATUSES.includes(status as TargetStatus)) throw new Error(`Invalid status: ${status}`);
  await updateTargetStatus(id, status as TargetStatus);
  revalidatePath("/");
}

export async function setTargetRead(id: string, isRead: boolean) {
  await updateTargetRead(id, isRead);
  revalidatePath("/");
}
