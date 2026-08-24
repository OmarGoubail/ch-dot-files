import test from "node:test";
import assert from "node:assert/strict";
import { assertDelegationContextFits, filteredConversation } from "../prompt.ts";
import { KeyedMutex, Semaphore } from "../concurrency.ts";

test("conversation handoff keeps user and assistant text but strips tools and results", () => {
	const entries = [
		{ type: "message", message: { role: "user", content: [{ type: "text", text: "question" }] } },
		{ type: "message", message: { role: "assistant", content: [{ type: "text", text: "answer" }, { type: "toolCall", name: "read", arguments: { path: "secret" } }] } },
		{ type: "message", message: { role: "toolResult", content: [{ type: "text", text: "file contents" }] } },
	] as any;
	assert.equal(filteredConversation(entries), "User:\nquestion\n\nAssistant:\nanswer");
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
