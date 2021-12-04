import { createStore, Reducer } from "../lib/fabux";
import { Provider, useCanUndo, useDispatch, useDispatchListener, useSelector, useUndo } from "../lib/react-fabux";
import { useCallback, useMemo, useState } from "react";

interface Todo {
    id: number;
    title: string;
    completed: boolean;
}

interface AppState {
    userName: string;
    todos: Todo[];
}

interface AddTodo {
    type: "addTodo";
    title: string;
    id: number;
}

interface CompleteTodo {
    type: "completeTodo";
    id: number;
}

interface UpdateName {
    type: "updateName";
    name: string;
}

type AppAction = AddTodo | CompleteTodo | UpdateName;

const initialState: AppState = {
    userName: "",
    todos: [],
};

const reducer: Reducer<AppState, AppAction> = (state, action) => {
    switch (action.type) {
        case "addTodo":
            return {
                ...state,
                todos: [...state.todos, { id: action.id, title: action.title, completed: false }],
            };
        case "completeTodo": {
            const foundTodo = state.todos.find((todo) => todo.id === action.id);
            if (!foundTodo) {
                return state;
            }
            return {
                ...state,
                todos: [...state.todos.filter((todo) => todo.id !== action.id), { ...foundTodo, completed: true }],
            };
        }
        case "updateName":
            return { ...state, userName: action.name };
    }
    return state;
};

let idCounter = 0;

function addTodo(title: string): AddTodo {
    return { type: "addTodo", title, id: idCounter++ };
}

function AddTodoInput() {
    const dispatch = useDispatch<AppAction>();

    const [title, setTitle] = useState("");
    const handleAddClick = useCallback(() => {
        setTitle((title) => {
            if (title) {
                dispatch(addTodo(title));
            }
            return "";
        });
    }, [dispatch]);

    return (
        <div>
            <input type="text" value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
            <button onClick={handleAddClick}>Add</button>
        </div>
    );
}

function UndoRedo() {
    const [redoSymbol] = useState(() => Symbol("redoSymbol"));
    const undo = useUndo<AppAction>();
    const dispatch = useDispatch<AppAction>();
    const canUndo = useCanUndo();

    const [redoableActions, setRedoableActions] = useState<AppAction[]>([]);

    useDispatchListener<AppAction>((action) => {
        if ((action as any)[redoSymbol] !== redoSymbol) {
            setRedoableActions([]);
        }
    }, []);

    const doUndo = useCallback(() => {
        const undidAction = undo();
        if (undidAction) {
            setRedoableActions((redoableActions) => [...redoableActions, undidAction]);
        }
    }, [undo]);

    const doRedo = useCallback(() => {
        const actionToRedo = redoableActions[redoableActions.length - 1];
        if (actionToRedo) {
            dispatch({ ...actionToRedo, [redoSymbol]: redoSymbol });
            setRedoableActions(redoableActions.slice(0, redoableActions.length - 1));
        }
    }, [dispatch, redoableActions, redoSymbol]);

    return (
        <div>
            {canUndo && <button onClick={doUndo}>Undo</button>}
            {redoableActions.length > 0 && <button onClick={doRedo}>Redo</button>}
        </div>
    );
}

interface TodoProps {
    todo: Todo;
}

function Title() {
    const name = useSelector((state: AppState) => state.userName);
    console.log("title render");
    return <h1>Welcome, {name}</h1>;
}

function todoSort(a: Todo, b: Todo) {
    if (a.completed && !b.completed) {
        return 1;
    }
    if (b.completed && !a.completed) {
        return -1;
    }
    if (a.id < b.id) {
        return 1;
    }
    return -1;
}

function NameEditor() {
    const dispatch = useDispatch<AppAction>();
    const name = useSelector((state: AppState) => state.userName);
    return (
        <>
            Name:{" "}
            <input
                type="text"
                value={name}
                onChange={(e) => dispatch({ type: "updateName", name: e.currentTarget.value })}
            />
        </>
    );
}

function TodoItem({ todo }: TodoProps) {
    const dispatch = useDispatch<AppAction>();
    const handleCompleted = useCallback(() => {
        dispatch({ type: "completeTodo", id: todo.id });
    }, [dispatch, todo]);
    // console.log("todoItem render", todo.title);
    return (
        <div>
            <input type="checkbox" checked={todo.completed} disabled={todo.completed} onChange={handleCompleted} />
            <span style={{ textDecoration: todo.completed ? "line-through" : "none" }}>{todo.title}</span>
        </div>
    );
}

function TodoManager() {
    const todos = useSelector((state: AppState) => state.todos);
    const sortedTodos = useMemo(() => [...todos].sort(todoSort), [todos]);
    // console.log("TODOMGR render");
    return (
        <div>
            {sortedTodos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} />
            ))}
            <AddTodoInput />
        </div>
    );
}

function TodoInfo() {
    // const completedCount = useSelector(
    //   (state: AppState) => state.todos.filter((todo) => todo.completed).length
    // );
    const [addState, setAdd] = useState(0);
    const notCompletedCount = useSelector((state: AppState) => state.todos.length + addState);

    // console.log("todoInfo render");

    return (
        <div>
            {notCompletedCount} todo
            <button onClick={() => setAdd(addState + 1)}>+</button>
        </div>
    );
}

function Spacer({ height = 30 }: { height?: number }) {
    return <div style={{ marginTop: `${height}px` }} />;
}

export default function App() {
    const [store] = useState(() => createStore(reducer, initialState));
    const [showTitle, setShowTitle] = useState(true);

    return (
        <Provider store={store}>
            <div className="App">
                {showTitle && <Title />}
                <h2>Start editing to see some magic happen!</h2>
                <TodoManager />
                <Spacer height={15} />
                <TodoInfo />
                <Spacer />
                <NameEditor />
                <input type="checkbox" checked={showTitle} onChange={() => setShowTitle(!showTitle)} />
                <UndoRedo />
            </div>
        </Provider>
    );
}
