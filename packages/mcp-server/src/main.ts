import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { ResearchWriter } from "./ResearchWriter";
import { createResearchMcpServer } from "./server";

const writer = new ResearchWriter({ baseUrl: process.env.ZMIND_RUNTIME_URL });

void serveStdio(() => createResearchMcpServer(writer));
