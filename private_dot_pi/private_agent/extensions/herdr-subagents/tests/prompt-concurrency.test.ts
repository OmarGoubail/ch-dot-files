import test from "node:test";
import assert from "node:assert/strict";
import { assertDelegationContextFits, delegationConversation, filteredConversation } from "../prompt.ts";
import { KeyedMutex, Semaphore } from "../concurrency.ts";

test("conversation handoff keeps summaries, user, and assistant text but strips tools and results", () => {
	const messages = [
		{ role: "compactionSummary", summary: "Earlier work was compacted." },
		{ role: "branchSummary", summary: "The active branch was restored." },
		{ role: "user", content: [{ type: "text", text: "question" }] },
		{ role: "assistant", content: [{ type: "text", text: "answer" }, { type: "toolCall", name: "read", arguments: { path: "secret" } }] },
		{ role: "toolResult", content: [{ type: "text", text: "file contents" }] },
	] as any;
	assert.equal(
		filteredConversation(messages),
		"Earlier conversation summary:\nEarlier work was compacted.\n\nBranch summary:\nThe active branch was restored.\n\nUser:\nquestion\n\nAssistant:\nanswer",
	);
});

test("conversation handoff uses Pi's compaction-aware context", () => {
	const sessionManager = {
		buildContextEntries: () => [
			{ type: "compaction", summary: "condensed history" },
			{ type: "message", message: { role: "user", content: "effective context" } },
			{ type: "message", message: { role: "toolResult", content: "hidden result" } },
		],
		getBranch: () => { throw new Error("raw branch must not be read"); },
	};
	assert.equal(
		delegationConversation(sessionManager),
		"Earlier conversation summary:\ncondensed history\n\nUser:\neffective context",
	);
});

test("conversation handoff keeps the newest complete exchanges under 70k estimated tokens", () => {
	const messages = [
		{ role: "compactionSummary", summary: "keep-summary" },
		{ role: "user", content: `old-marker-${"x".repeat(200_000)}` },
		{ role: "assistant", content: `old-answer-${"x".repeat(100_000)}` },
		{ role: "user", content: "latest-question" },
		{ role: "assistant", content: "latest-answer" },
	];
	const result = filteredConversation(messages);
	assert.match(result, /Earlier conversation summary:\nkeep-summary/);
	assert.match(result, /Earlier conversation omitted/);
	assert.doesNotMatch(result, /old-marker/);
	assert.match(result, /User:\nlatest-question\n\nAssistant:\nlatest-answer/);
	assert.ok(result.length <= 280_000);
});

test("delegation context fails explicitly above the 100k-token estimate", () => {
	assert.throws(() => assertDelegationContextFits("x".repeat(400_001)), /above the 100,000-token/);
});

test("semaphore queues above its configured concurrency", async () => {
	const semaphore = new Semaphore(1);
	const first = await semaphore.acquire();
	let secondAcquired = false;
	const secondPromise = semaphore.acquire().then((release) => {
		secondAcquired = true;
		return release;
	});
	await new Promise((resolve) => setTimeout(resolve, 5));
	assert.equal(secondAcquired, false);
	first();
	const second = await secondPromise;
	assert.equal(secondAcquired, true);
	second();
});

test("writer mutex serializes one cwd without blocking another", async () => {
	const mutex = new KeyedMutex();
	const first = await mutex.acquire("cwd-a");
	let sameCwdAcquired = false;
	const queued = mutex.acquire("cwd-a").then((release) => {
		sameCwdAcquired = true;
		return release;
	});
	const other = await mutex.acquire("cwd-b");
	assert.equal(sameCwdAcquired, false);
	other();
	first();
	const second = await queued;
	assert.equal(sameCwdAcquired, true);
	second();
});
