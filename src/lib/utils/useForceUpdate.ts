import { useReducer } from "react";

export function useForceUpdate() {
    const [, forceUpdate] = useReducer((n: number) => n + 1, 1);
    return forceUpdate;
}
