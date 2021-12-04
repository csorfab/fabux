import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useRef } from "react";
import { Store, AnyAction, Dispatch, Undo, Subscriber } from "./fabux";
import { createDeferredExecutionQueue } from "./utils/deferredExecutionQueue";
import { useForceUpdate } from "./utils/useForceUpdate";

export const FabuxContext = createContext<Store<any, AnyAction> | null>(null);

interface ProviderProps<State, Action extends AnyAction> {
    store: Store<State, Action>;
}

export function Provider<State, Action extends AnyAction>({
    store,
    children,
}: PropsWithChildren<ProviderProps<State, Action>>) {
    return (
        <FabuxContext.Provider value={store as unknown as Store<State, AnyAction>}>{children}</FabuxContext.Provider>
    );
}

interface Selector<State, SelectedValue> {
    (state: State): SelectedValue;
}

export function useStore<State, Action extends AnyAction>(): Store<State, Action> {
    const store = useContext(FabuxContext);
    if (!store) {
        throw new Error("useStore: no Redux store provided");
    }
    return store as unknown as Store<State, Action>;
}

export function useSubscription(subscriber: Subscriber, deps: any[]) {
    const store = useStore();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedSubscriber = useMemo(() => subscriber, deps);

    useEffect(() => {
        const queue = createDeferredExecutionQueue();
        const storeSubscriber = () => {
            queue.execute(memoizedSubscriber);
        };
        const unsubscribeFromStore = store.subscribe(storeSubscriber);
        return () => {
            unsubscribeFromStore();
            queue.clear();
        };
    }, [store, memoizedSubscriber]);
}

interface DispatchListener<Action extends AnyAction> {
    (action: Action): void;
}

export function useDispatchListener<Action extends AnyAction>(listener: DispatchListener<Action>, deps: any[]) {
    const store = useStore<any, Action>();

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedListener = useMemo(() => listener, deps);

    useEffect(() => {
        const queue = createDeferredExecutionQueue();
        const middleware = (action: Action) => {
            queue.execute(() => memoizedListener(action));
            return action;
        };
        const removeMiddleware = store.addMiddleware(middleware);
        return () => {
            removeMiddleware();
            queue.clear();
        };
    }, [store, memoizedListener]);
}

const uninitializedSymbol = Symbol("uninitialized");
type Uninitialized = typeof uninitializedSymbol;

export function useSelector<State, SelectedValue>(selector: Selector<State, SelectedValue>): SelectedValue {
    const store = useStore<State, AnyAction>();
    const forceUpdate = useForceUpdate();

    const selectorRef = useRef<Selector<State, SelectedValue>>(selector);
    const selectedValueRef = useRef<SelectedValue | Uninitialized>(uninitializedSymbol);

    if (selectorRef.current !== selector || selectedValueRef.current === uninitializedSymbol) {
        selectorRef.current = selector;
        const nextValue = selector(store.getState());
        if (selectedValueRef.current !== nextValue) {
            selectedValueRef.current = nextValue;
        }
    }

    useSubscription(() => {
        const selector = selectorRef.current;
        const nextValue = selector(store.getState());
        if (selectedValueRef.current !== nextValue) {
            selectedValueRef.current = nextValue;
            forceUpdate();
        }
    }, [store, forceUpdate]);

    return selectedValueRef.current;
}

export function useDispatch<Action extends AnyAction>(): Dispatch<Action> {
    return useStore().dispatch;
}

export function useUndo<Action extends AnyAction>(): Undo<Action> {
    return useStore<any, Action>().undo;
}

export function useCanUndo(): boolean {
    const store = useStore();
    const forceUpdate = useForceUpdate();
    const canUndoRef = useRef<boolean>();
    if (canUndoRef.current === undefined) {
        canUndoRef.current = store.canUndo();
    }

    useSubscription(() => {
        const canUndo = store.canUndo();
        if (canUndo !== canUndoRef.current) {
            canUndoRef.current = canUndo;
            forceUpdate();
        }
    }, [store]);

    return canUndoRef.current;
}
