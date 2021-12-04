import {
    createContext,
    PropsWithChildren,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { Store, AnyAction, Dispatch, Undo, Subscriber } from "./fabux";
import { createDeferredExecutionQueue } from "./defferedExecutionQueue"

export const FabuxContext = createContext<Store<any, AnyAction> | null>(null);

interface ProviderProps<State, Action extends AnyAction> {
    store: Store<State, Action>;
}

export function Provider<State, Action extends AnyAction>({
    store,
    children
}: PropsWithChildren<ProviderProps<State, Action>>) {
    return (
        <FabuxContext.Provider
            value={(store as unknown) as Store<State, AnyAction>}
        >
            {children}
        </FabuxContext.Provider>
    );
}

interface Selector<State, SelectedValue> {
    (state: State): SelectedValue;
}

export function useStore<State, Action extends AnyAction>(): Store<
    State,
    Action
> {
    const store = useContext(FabuxContext);
    if (!store) {
        throw new Error("useStore: no Redux store provided");
    }
    return (store as unknown) as Store<State, Action>;
}

interface DispatchListener<Action extends AnyAction> {
    (action: Action): void;
}

export function useDispatchListener<Action extends AnyAction>(
    listener: DispatchListener<Action>,
    deps: any[]
) {
    const store = useStore<any, Action>();
    const memoizedListener = useMemo(() => listener, deps);
    useEffect(() => {
        const queue = createDeferredExecutionQueue();
        const middleware = (action: Action) => {
            queue.execute(() => memoizedListener(action));
            return action;
        };
        const unsubscribe = store.addMiddleware(middleware);
        return () => {
            unsubscribe();
            queue.clear();
        };
    }, [store, memoizedListener]);
}

export function useSubscription(subscriber: Subscriber, deps: any[]) {
    const store = useStore();
    const memoizedSubscriber = useMemo(() => subscriber, deps);
    useEffect(() => {
        const queue = createDeferredExecutionQueue();
        const subscriber = () => {
            queue.execute(memoizedSubscriber);
        };
        const unsubscribe = store.subscribe(subscriber);
        return () => {
            unsubscribe();
            queue.clear();
        };
    }, [store, memoizedSubscriber]);
}

export function useCanUndo() {
    const store = useStore();
    const [canUndo, setCanUndo] = useState(() => store.canUndo());
    const canUndoRef = useRef(canUndo);

    useSubscription(() => {
        const newCanUndo = store.canUndo();
        if (newCanUndo !== canUndoRef.current) {
            canUndoRef.current = newCanUndo;
            setCanUndo(newCanUndo);
        }
    }, [store]);

    return canUndo;
}

function useForceUpdate() {
    const [, setCounter] = useState(0);
    return useCallback(() => setCounter((count) => count + 1), []);
}

export function useSelector<State, SelectedValue>(
    selector: Selector<State, SelectedValue>
): SelectedValue {
    const store = useStore<State, AnyAction>();
    const forceUpdate = useForceUpdate();

    const selectorRef = useRef<Selector<State, SelectedValue>>();
    const selectedValueRef = useRef<SelectedValue>();

    if (selectorRef.current !== selector) {
        selectorRef.current = selector;
        const nextValue = selector(store.getState());
        if (selectedValueRef.current !== nextValue) {
            selectedValueRef.current = nextValue;
        }
    }

    useSubscription(() => {
        const selector = selectorRef.current;
        const nextValue = selector!(store.getState());
        if (selectedValueRef.current !== nextValue) {
            selectedValueRef.current = nextValue;
            forceUpdate();
        }
    }, [store, forceUpdate]);

    return selectedValueRef.current!;
}

export function useDispatch<Action extends AnyAction>(): Dispatch<Action> {
    return useStore().dispatch;
}

export function useUndo<Action extends AnyAction>(): Undo<Action> {
    return useStore<any, Action>().undo;
}
