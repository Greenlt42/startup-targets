"use server";

import { revalidatePath } from "next/cache";
import { updateTargetStatus, STATUSES, type TargetStatus } from "@/lib/targets";

export async function setTargetStatus(id: string, status: string) {
  if (!STATUSES.includes(status as TargetStatus)) throw new Error(`Invalid status: ${status}`);
  await updateTargetStatus(id, status as TargetStatus);
  revalidatePath("/");
}
