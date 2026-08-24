type Waiter = {
	resolve: (release: () => void) => void;
	reject: (error: Error) => void;
	signal?: AbortSignal;
	onAbort?: () => void;
};

export class Semaphore {
	private active = 0;
	private readonly queue: Waiter[] = [];
	private readonly limit: number;

	constructor(limit: number) {
		if (!Number.isInteger(limit) || limit < 1) throw new Error("Semaphore limit must be a positive integer.");
		this.limit = limit;
	}

	async acquire(signal?: AbortSignal): Promise<() => void> {
		if (signal?.aborted) throw new Error("Launch aborted while waiting for capacity.");
		if (this.active < this.limit) {
			this.active += 1;
			return this.releaseOnce();
		}
		return await new Promise<() => void>((resolve, reject) => {
			const waiter: Waiter = { resolve, reject, signal };
			waiter.onAbort = () => {
				const index = this.queue.indexOf(waiter);
				if (index >= 0) this.queue.splice(index, 1);
				reject(new Error("Launch aborted while waiting for capacity."));
			};
			signal?.addEventListener("abort", waiter.onAbort, { once: true });
			this.queue.push(waiter);
		});
	}

	private releaseOnce(): () => void {
		let released = false;
		return () => {
			if (released) return;
			released = true;
			const next = this.queue.shift();
			if (next) {
				next.signal?.removeEventListener("abort", next.onAbort!);
				next.resolve(this.releaseOnce());
				return;
			}
			this.active -= 1;
		};
	}
}

export class KeyedMutex {
	private readonly semaphores = new Map<string, Semaphore>();
	private readonly references = new Map<string, number>();

	async acquire(key: string, signal?: AbortSignal): Promise<() => void> {
		const semaphore = this.semaphores.get(key) ?? new Semaphore(1);
		this.semaphores.set(key, semaphore);
		this.references.set(key, (this.references.get(key) ?? 0) + 1);
		try {
			const release = await semaphore.acquire(signal);
			return () => {
				release();
				const remaining = (this.references.get(key) ?? 1) - 1;
				if (remaining <= 0) {
					this.references.delete(key);
					this.semaphores.delete(key);
				} else {
					this.references.set(key, remaining);
				}
			};
		} catch (error) {
			const remaining = (this.references.get(key) ?? 1) - 1;
			if (remaining <= 0) {
				this.references.delete(key);
				this.semaphores.delete(key);
			} else {
				this.references.set(key, remaining);
			}
			throw error;
		}
	}
}
