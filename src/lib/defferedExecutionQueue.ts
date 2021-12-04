
export interface Cancel {
    (): void;
}

export interface Task {
    (): void;
}

export interface DeferredExecutionQueue {
    execute(task: Task): Cancel;
    flush(): void;
    clear(): void;
}

export function createDeferredExecutionQueue(): DeferredExecutionQueue {
    let queue = new Map<Symbol, Task>();
    let currentTimeout: number | null = null;

    function runAllTasks() {
        for (const [id, task] of queue) {
            queue.delete(id);
            task();
        }
    }

    function startTimeout() {
        if (currentTimeout !== null) {
            return;
        }
        currentTimeout = setTimeout(() => {
            currentTimeout = null;
            runAllTasks();
        }, 0);
    }

    function cancelTimeout() {
        if (currentTimeout !== null) {
            clearTimeout(currentTimeout);
            currentTimeout = null;
        }
    }

    return {
        execute(task) {
            const id = Symbol("taskId");
            queue.set(id, task);
            startTimeout();
            return () => {
                queue.delete(id);
            };
        },
        flush() {
            cancelTimeout();
            runAllTasks();
        },
        clear() {
            cancelTimeout();
            queue.clear();
        }
    };
}