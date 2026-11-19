import { describe, expect, it } from "vitest";
import Anthropic from "@anthropic-ai/sdk";
import { runAdvisor, runAdvisorTool, ADVISOR_MODEL, SOURCING_RULES } from "../../workers/advisorAgent";
import { runLocalDataTool } from "../../workers/localData";

describe("Advisor Agent Offline Mock Harness", () => {
  it("completes a single-turn answer with end_turn stop reason", async () => {
    const fakeClient = {
      beta: {
        messages: {
          create: async (body: any) => ({
            id: "msg_1",
            type: "message" as const,
            role: "assistant" as const,
            model: ADVISOR_MODEL,
            content: [{ type: "text" as const, text: "Austin, TX 2-bedroom FMR is $1,817 per HUD FY2027." }],
            stop_reason: "end_turn" as const,
            stop_sequence: null,
            usage: { input_tokens: 50, output_tokens: 25 },
          }),
        },
      },
    };

    const res = await runAdvisor(fakeClient as any, "System prompt", [{ role: "user", content: "What is the Austin rent?" }], {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.text).toContain("$1,817");
    expect(res.tool_rounds).toBe(0);
    expect(res.sources).toEqual([]);
  });

  it("handles multi-turn tool calling and collects sources", async () => {
    const replies = [
      {
        id: "msg_1",
        type: "message" as const,
        role: "assistant" as const,
        model: ADVISOR_MODEL,
        content: [
          { type: "text" as const, text: "Let me check California state housing laws." },
          { type: "tool_use" as const, id: "tool_call_1", name: "state_housing_laws", input: { state: "CA" } },
        ],
        stop_reason: "tool_use" as const,
        stop_sequence: null,
        usage: { input_tokens: 50, output_tokens: 30 },
      },
      {
        id: "msg_2",
        type: "message" as const,
        role: "assistant" as const,
        model: ADVISOR_MODEL,
        content: [{ type: "text" as const, text: "California SB 9 allows ministerial lot splits under certain conditions." }],
        stop_reason: "end_turn" as const,
        stop_sequence: null,
        usage: { input_tokens: 120, output_tokens: 20 },
      },
    ];

    let callCount = 0;
    const fakeClient = {
      beta: {
        messages: {
          create: async (body: any) => {
            const resp = replies[callCount++];
            return resp;
          },
        },
      },
    };

    const res = await runAdvisor(fakeClient as any, "System prompt", [{ role: "user", content: "Tell me about CA housing laws" }], {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.text).toContain("SB 9");
    expect(res.tool_rounds).toBe(1);
    expect(res.sources.length).toBeGreaterThanOrEqual(1);
    expect(res.sources[0].url).toContain("statutes.json");
  });

  it("stops and reports error on RateLimitError", async () => {
    const fakeClient = {
      beta: {
        messages: {
          create: async () => {
            throw new Anthropic.RateLimitError(429, { error: { message: "Rate limit exceeded" } }, "Rate limit exceeded", new Headers());
          },
        },
      },
    };

    const res = await runAdvisor(fakeClient as any, "System", [{ role: "user", content: "Hi" }], {});
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(429);
    expect(res.error).toContain("busy");
  });

  it("stops and reports error on AuthenticationError", async () => {
    const fakeClient = {
      beta: {
        messages: {
          create: async () => {
            throw new Anthropic.AuthenticationError(401, { error: { message: "Invalid key" } }, "Invalid key", new Headers());
          },
        },
      },
    };

    const res = await runAdvisor(fakeClient as any, "System", [{ role: "user", content: "Hi" }], {});
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(503);
    expect(res.error).toContain("key is not valid");
  });

  it("handles refusal stop_reason as error", async () => {
    const fakeClient = {
      beta: {
        messages: {
          create: async () => ({
            id: "msg_refuse",
            type: "message" as const,
            role: "assistant" as const,
            model: ADVISOR_MODEL,
            content: [],
            stop_reason: "refusal" as const,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 0 },
          }),
        },
      },
    };

    const res = await runAdvisor(fakeClient as any, "System", [{ role: "user", content: "Hi" }], {});
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(422);
    expect(res.error).toContain("declined to answer");
  });

  it("handles max_tokens stop_reason with truncation notice", async () => {
    const fakeClient = {
      beta: {
        messages: {
          create: async () => ({
            id: "msg_trunc",
            type: "message" as const,
            role: "assistant" as const,
            model: ADVISOR_MODEL,
            content: [{ type: "text" as const, text: "Detailed analysis cut short..." }],
            stop_reason: "max_tokens" as const,
            stop_sequence: null,
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        },
      },
    };

    const res = await runAdvisor(fakeClient as any, "System", [{ role: "user", content: "Explain everything" }], {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.text).toContain("[Answer cut off at the length limit.]");
    expect(res.stopped_early).toBe("max_tokens");
  });

  it("enforces MAX_TOOL_ROUNDS=6 limit", async () => {
    const loopReply = {
      id: "msg_loop",
      type: "message" as const,
      role: "assistant" as const,
      model: ADVISOR_MODEL,
      content: [
        { type: "tool_use" as const, id: "tool_loop", name: "research_studies", input: { topic: "trees" } },
      ],
      stop_reason: "tool_use" as const,
      stop_sequence: null,
      usage: { input_tokens: 50, output_tokens: 20 },
    };

    const fakeClient = {
      beta: {
        messages: {
          create: async () => loopReply,
        },
      },
    };

    const res = await runAdvisor(fakeClient as any, "System", [{ role: "user", content: "Neverending" }], {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.stopped_early).toBe("tool_rounds");
    expect(res.tool_rounds).toBe(6);
    expect(res.text).toContain("ran out of lookup steps");
  });

  it("validates input parameters on runAdvisorTool", async () => {
    // Missing lat/lng
    const r1 = await runAdvisorTool("lookup_site_facts", {}, {});
    expect(r1.isError).toBe(true);
    expect(r1.text).toContain("lat and lng must be numbers");

    // Missing address
    const r2 = await runAdvisorTool("geocode_address", { address: "" }, {});
    expect(r2.isError).toBe(true);
    expect(r2.text).toContain("address is required");

    // Invalid OSM kind
    const r3 = await runAdvisorTool("osm_features_near", { lat: 30, lng: -97, radius_m: 100, kind: "unknown_tag" }, {});
    expect(r3.isError).toBe(true);
    expect(r3.text).toContain("unknown kind");

    // Unknown tool
    const r4 = await runAdvisorTool("non_existent_tool", {}, {});
    expect(r4.isError).toBe(true);
    expect(r4.text).toContain("Unknown tool");
  });

  it("runs all local data tools successfully", async () => {
    const tools = [
      { name: "state_housing_laws", input: { state: "CA" } },
      { name: "funding_programs", input: { state: "CA", county_fips: "06037" } },
      { name: "research_studies", input: { topic: "trees" } },
      { name: "construction_unit_costs", input: { item: "sidewalk", state: "CA" } },
      { name: "transit_projects", input: { state: "CA", county_fips: "06037" } },
      { name: "county_data_coverage", input: { county_fips: "06037" } },
      { name: "improvement_evidence", input: { id: "trees" } },
    ];

    for (const t of tools) {
      const res = await runAdvisorTool(t.name, t.input, {});
      expect(res.isError).toBe(false);
      const parsed = JSON.parse(res.text);
      expect(parsed.ok).toBe(true);
      expect(res.sources.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("deduplicates identical source URLs across multiple tool invocations", async () => {
    const replies = [
      {
        id: "msg_1",
        type: "message" as const,
        role: "assistant" as const,
        model: ADVISOR_MODEL,
        content: [
          { type: "tool_use" as const, id: "tool_1", name: "state_housing_laws", input: { state: "CA" } },
          { type: "tool_use" as const, id: "tool_2", name: "state_housing_laws", input: { state: "CA" } },
        ],
        stop_reason: "tool_use" as const,
        stop_sequence: null,
        usage: { input_tokens: 50, output_tokens: 30 },
      },
      {
        id: "msg_2",
        type: "message" as const,
        role: "assistant" as const,
        model: ADVISOR_MODEL,
        content: [{ type: "text" as const, text: "Answer with CA laws." }],
        stop_reason: "end_turn" as const,
        stop_sequence: null,
        usage: { input_tokens: 100, output_tokens: 20 },
      },
    ];

    let callCount = 0;
    const fakeClient = {
      beta: {
        messages: {
          create: async () => replies[callCount++],
        },
      },
    };

    const res = await runAdvisor(fakeClient as any, "System", [{ role: "user", content: "Query" }], {});
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const urls = res.sources.map((s) => s.url);
    const uniqueUrls = new Set(urls);
    expect(urls.length).toBe(uniqueUrls.size);
  });
});
