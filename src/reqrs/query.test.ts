import { createQuery } from "./query";
import { createInitalNormalizedState, createNormalizedStateReducers } from "./normalized";
// Test of type safety

export interface Test {
    id: string;
    message: string
}

const initalState = createInitalNormalizedState<Test, string>();
const { reducers, effectReducers } = createNormalizedStateReducers<Test, Test, string>(payload => payload, payload => payload.id);

const result: Test = {
    id: "1",
    message: "Hallo"
}

const query = createQuery({
    name: 'hallo',
    initialState: initalState,
    request: () => new Promise<Test>((resolve, reject) => resolve(result)),
    reducers,
    effectReducers
});