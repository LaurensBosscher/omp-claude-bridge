/**
 * OMP encodes private-use glyphs as `⟦Uxxxx⟧` tokens on the wire to Claude-class models
 * and appends a notice to the system prompt. The capture recorded at turn_start holds the
 * raw glyphs, so the bridge must still resolve it and forward the projection encoded.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyGlyphCodec } from "@oh-my-pi/pi-ai";

const tmpRoot = mkdtempSync(join(tmpdir(), "claude-bridge-glyph-"));
process.env.PI_CODING_AGENT_DIR = join(tmpRoot, "agent");
delete process.env.CLAUDE_BRIDGE_DEBUG;
process.on("exit", () => rmSync(tmpRoot, { recursive: true, force: true }));

const { default: activate, __test } = await import("../src/index.js");

let providerConfig;
activate({
	on: () => {},
	registerProvider: (_name, config) => { providerConfig = config; },
	registerTool: () => {},
});
const model = providerConfig.models[0];

afterEach(() => __test.setQuery(null));

describe("a glyph-encoded system prompt", () => {
	it("resolves the raw capture and forwards its projection encoded", async () => {
		const raw = "Memory: \uE0B0 …/savex/infrastructure \uF418 main, literal \u27E6U1234\u27E7 text.";
		__test.promptCaptures.record(raw, { custom: raw, contextFiles: [], skills: [] }, "turn_start");
		const encoded = applyGlyphCodec({
			systemPrompt: [raw],
			messages: [{ role: "user", content: "hi", timestamp: 0 }],
			tools: [],
		}).context;
		const [encodedPrompt] = encoded.systemPrompt;
		assert.notEqual(encodedPrompt, raw);

		let append;
		__test.setQuery(({ options }) => {
			append = options.systemPrompt.append;
			return {
				async *[Symbol.asyncIterator]() {
					yield { type: "result", subtype: "success", result: "ok" };
				},
				close() {},
				async interrupt() {},
			};
		});
		const result = await providerConfig.streamSimple(
			model,
			{ ...encoded, systemPrompt: encodedPrompt },
			{ sessionId: "pi-session" },
		).result();

		assert.notEqual(result.stopReason, "error", result.errorMessage);
		assert.ok(append.includes(encodedPrompt), "projection must carry the prompt exactly as OMP encodes it");
		assert.ok(!append.includes("\uE0B0"), "raw glyphs must not reach Claude Code");
	});
});
