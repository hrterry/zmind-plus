import { syntheticResearchEvents } from "@zmind-plus/core";

const endpoint = process.env.ZMIND_RUNTIME_URL ?? "http://127.0.0.1:4310";
const runId = syntheticResearchEvents[0]!.runId;
const response = await fetch(`${endpoint}/api/runs/${runId}/events`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(syntheticResearchEvents),
});

const body: unknown = await response.json();
if (!response.ok) {
  console.error("Could not seed the synthetic research run.", body);
  process.exitCode = 1;
} else {
  console.log("Synthetic research run is ready.", body);
}
