import { describe, it, expect } from "vitest";

/**
 * Integration tests for the settings API routes.
 * Tests the full pipeline: route handler → DB queries → response.
 * No seeding needed — settings has pure get/set behavior.
 */

async function callSettings(method: "GET" | "PUT", body?: unknown) {
  const mod = await import("@/app/api/settings/route");
  const url = "http://localhost:3000/api/settings";
  const request = new Request(url, {
    method,
    ...(body
      ? { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }
      : {}),
  });

  if (method === "GET") return mod.GET();
  return mod.PUT(request);
}

describe("GET /api/settings", () => {
  it("returns defaults", async () => {
    const res = await callSettings("GET");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.todoist_api_key).toBeNull();
    expect(data.has_api_key).toBe(false);
    expect(data.day_capacity_mins).toBe(360);
    expect(data.planning_completed_today).toBe(false);
  });
});

describe("PUT /api/settings — todoist_api_key", () => {
  it("sets key, GET returns masked and has_api_key true", async () => {
    const putRes = await callSettings("PUT", {
      todoist_api_key: "my-secret-key-12345",
    });
    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.success).toBe(true);

    const getRes = await callSettings("GET");
    const getData = await getRes.json();
    expect(getData.todoist_api_key).toBe("••••••••");
    expect(getData.has_api_key).toBe(true);
  });

  it("returns 400 for empty string", async () => {
    const res = await callSettings("PUT", {
      todoist_api_key: "",
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("PUT /api/settings — day_capacity_mins", () => {
  it("updates capacity, GET reflects new value", async () => {
    const putRes = await callSettings("PUT", {
      day_capacity_mins: 480,
    });
    expect(putRes.status).toBe(200);

    const getRes = await callSettings("GET");
    const getData = await getRes.json();
    expect(getData.day_capacity_mins).toBe(480);
  });

  it("returns 400 for negative value", async () => {
    const res = await callSettings("PUT", {
      day_capacity_mins: -100,
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

describe("PUT /api/settings — planning_completed_date", () => {
  it("sets planning completed for today, GET returns true", async () => {
    const today = new Date().toISOString().slice(0, 10);

    const putRes = await callSettings("PUT", {
      planning_completed_date: today,
    });
    expect(putRes.status).toBe(200);

    const getRes = await callSettings("GET");
    const getData = await getRes.json();
    expect(getData.planning_completed_today).toBe(true);
  });
});
