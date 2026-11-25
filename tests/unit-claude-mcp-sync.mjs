import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeConnectors, skillMarkdown } from "../src/claude-mcp-sync.js";

const notion = { id: "mcpsrv_notion", display_name: "Notion", eligible: true };
const m365 = { id: "mcpsrv_m365", display_name: "Microsoft 365", eligible: true };

describe("mergeConnectors", () => {
	it("replaces claude-ai entries and keeps everything else", () => {
		const file = {
			disabledServers: ["github"],
			mcpServers: {
				github: { type: "http", url: "https://api.githubcopilot.com/mcp/" },
				"claude-ai-gone": { type: "http", url: "https://mcp-proxy.anthropic.com/v1/mcp/old", headers: {} },
			},
		};
		const merged = mergeConnectors(file, [notion, m365], "!token");
		assert.deepEqual(Object.keys(merged.mcpServers), ["github", "claude-ai-notion", "claude-ai-microsoft-365"]);
		assert.deepEqual(merged.disabledServers, ["github"]);
		assert.equal(merged.mcpServers.github, file.mcpServers.github);
		assert.equal(merged.mcpServers["claude-ai-notion"].url, "https://mcp-proxy.anthropic.com/v1/mcp/mcpsrv_notion");
		assert.equal(merged.mcpServers["claude-ai-notion"].headers.Authorization, "!token");
	});

	it("keeps an entry's client session id across syncs", () => {
		const first = mergeConnectors({}, [notion], "!token");
		const id = first.mcpServers["claude-ai-notion"].headers["X-Mcp-Client-Session-Id"];
		assert.match(id, /^[0-9a-f-]{36}$/);
		const second = mergeConnectors(first, [notion], "!token");
		assert.equal(second.mcpServers["claude-ai-notion"].headers["X-Mcp-Client-Session-Id"], id);
	});

	it("keeps user-set enabled and instructions flags", () => {
		const first = mergeConnectors({}, [notion], "!token");
		first.mcpServers["claude-ai-notion"].enabled = false;
		first.mcpServers["claude-ai-notion"].instructions = false;
		const second = mergeConnectors(first, [notion], "!token");
		assert.equal(second.mcpServers["claude-ai-notion"].enabled, false);
		assert.equal(second.mcpServers["claude-ai-notion"].instructions, false);
	});

	it("turns off prompt instructions for connectors with a skill unless the entry sets them", () => {
		const merged = mergeConnectors({}, [notion, m365], "!token", new Set(["claude-ai-notion"]));
		assert.equal(merged.mcpServers["claude-ai-notion"].instructions, false);
		assert.equal(merged.mcpServers["claude-ai-microsoft-365"].instructions, undefined);
		merged.mcpServers["claude-ai-notion"].instructions = true;
		const resynced = mergeConnectors(merged, [notion, m365], "!token", new Set(["claude-ai-notion"]));
		assert.equal(resynced.mcpServers["claude-ai-notion"].instructions, true);
	});

	it("writes a skill whose description names the server's tool prefix", () => {
		const skill = skillMarkdown(m365, "Use ids.");
		assert.match(skill, /^---\nname: claude-ai-microsoft-365\ndescription: "Read before calling mcp__claude_ai_microsoft_365_\* tools/);
		assert.match(skill, /Use ids\.\n$/);
	});
});
