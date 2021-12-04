export interface AnyAction {
    type: string;
}

export interface Dispatch<Action extends AnyAction> {
    (action: Action): void;
}

export interface Undo<Action extends AnyAction> {
    (): Action | undefined;
}

export interface Store<State, Action extends AnyAction> {
    dispatch: Dispatch<Action>;
    undo: Undo<Action>;
    getState(): State;
    canUndo(): boolean;
    subscribe(subscriber: Subscriber): Unsubscribe;
    addMiddleware(middleware: Middleware<Action>): Unsubscribe;
}

export interface Reducer<State, Action extends AnyAction> {
    (state: State, action: Action): State;
}

export interface Unsubscribe {
    (): void;
}

export interface Subscriber {
    (): void;
}

export interface Middleware<Action extends AnyAction> {
    (action: Action): Action;
}

function invoke<T extends () => void>(f: T) {
    f();
}

export function createStore<State, Action extends AnyAction>(
    rootReducer: Reducer<State, Action>,
    initialState: State,
): Store<State, Action> {
    const actionHistory: Action[] = [];
    let state = initialState;
    const subscribers = new Map<Symbol, Subscriber>();
    const middlewares = new Map<Symbol, Middleware<Action>>();

    function notifyAll() {
        subscribers.forEach(invoke);
    }

    function setState(nextState: State) {
        state = nextState;
        notifyAll();
    }

    return {
        getState() {
            return state;
        },
        dispatch(action) {
            action = Array.from(middlewares.values()).reduce((action, middleware) => middleware(action), action);
            actionHistory.push(action);
            const nextState = rootReducer(state, action);
            setState(nextState);
        },
        subscribe(subscriber) {
            const subscriberId = Symbol("subscriber");
            subscribers.set(subscriberId, subscriber);
            const unsubscribe = () => {
                subscribers.delete(subscriberId);
            };
            return unsubscribe;
        },
        addMiddleware(middleware) {
            const middlewareId = Symbol("middleware");
            middlewares.set(middlewareId, middleware);
            const unsubscribe = () => {
                middlewares.delete(middlewareId);
            };
            return unsubscribe;
        },
        undo() {
            if (actionHistory.length === 0) {
                return undefined;
            }
            const undidAction = actionHistory.pop();
            const nextState = actionHistory.reduce(rootReducer, initialState);
            setState(nextState);
            return undidAction;
        },
        canUndo() {
            return actionHistory.length > 0;
        },
    };
}
