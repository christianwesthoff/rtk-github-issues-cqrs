import { createQuery } from "./query";
import { createInitalNormalizedState, createNormalizedStateReducers } from "./normailzed";
// Test of type safety

export interface Test {
    id: string;
    message: string
}

const initalState = createInitalNormalizedState<Test, string>();
const { reducers, effectReducers } = createNormalizedStateReducers<Test, Test, string>(payload => payload, payload => payload.id);

const query = createQuery({
    name: 'hallo',
    initialState: initalState,
    request: () => new Promise((resolve) => {
        resolve({ message: "Hello World", id: 1 });
    }),
    reducers,
    effectReducers
});