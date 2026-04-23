import { format } from "date-fns";
import { fetchNoStore, jsonRequestInit } from "@/lib/client/http";
import type { FlowMutationAction, FlowStateResponse } from "../contracts";
import type { SettingsResponse } from "@/features/settings/contracts";

export function todayStr() {
  return format(new Date(), "yyyy-MM-dd");
}

export function persistFlowMutation(
  body: FlowMutationAction | { action: "addCompleted" | "removeCompleted"; date: string; taskId: string },
  onFailure: () => void
) {
  fetch("/api/flows", jsonRequestInit("PUT", body))
    .then((response) => {
      if (!response.ok) onFailure();
    })
    .catch(() => onFailure());
}

export function persistPlanningCompleted(date: string) {
  void fetch(
    "/api/settings",
    jsonRequestInit("PUT", { planning_completed_date: date })
  ).catch(() => {});
}

export async function loadFlowState(): Promise<FlowStateResponse | null> {
  const response = await fetchNoStore("/api/flows");
  if (!response.ok) return null;
  const data = (await response.json()) as FlowStateResponse;
  return {
    flows: data.flows ?? {},
    completedTasks: data.completedTasks ?? {},
  };
}

export async function loadHydrationData(today: string): Promise<{
  flowState: FlowStateResponse | null;
  settings: SettingsResponse | null;
}> {
  const [flowResponse, settingsResponse] = await Promise.all([
    fetchNoStore("/api/flows"),
    fetchNoStore(`/api/settings?today=${encodeURIComponent(today)}`),
  ]);

  const flowState = flowResponse.ok
    ? (((await flowResponse.json()) as FlowStateResponse) ?? null)
    : null;
  const settings = settingsResponse.ok
    ? (((await settingsResponse.json()) as SettingsResponse) ?? null)
    : null;

  return { flowState, settings };
}
