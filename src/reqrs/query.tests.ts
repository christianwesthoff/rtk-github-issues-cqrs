import { createQuery } from "./query";
import { createInitalNormalizedState, createNormalizedStateReducers } from "./normailzed";
// Test of type safety

export interface Test {
    id: string;
    test: string
}

const initalState = createInitalNormalizedState<Test, string>();
const { reducers, effectReducers } = createNormalizedStateReducers<Test, Test, string>(payload => payload, payload => payload.id);

const query = createQuery({
    name: 'hallo',
    initialState: initalState,
    request: () => new Promise((resolve) => {
        resolve("Hello World");
    }),
    reducers,
    effectReducers
});