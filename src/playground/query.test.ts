import { createQuery } from "./query";
import { createInitalNormalizedState, createNormalizedStateReducers } from "./normalized";
import { createCommand } from "./command";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Test {
    id: string;
    message: string
}

const initalState = createInitalNormalizedState<Test, string>();
const { reducers, effectReducers } = createNormalizedStateReducers<Test, Test, string>(payload => payload, payload => payload.id);



// const result: Test = {
//     id: "1",
//     message: "Hallo"
// }

// const query = createQuery({
//     name: 'hallo',
//     initialState: initalState,
//     request: () => new Promise<Test>((resolve, reject) => resolve(result)),
//     reducers,
//     effectReducers
// });

// const command = createCommand({
//     name: 'update_hallo',
//     request: () => new Promise<Test>((resolve, reject) => resolve(result)),
//     connect: (dispatch, payload) => {
//         dispatch(query.effects.retrieveOne(payload));
//     }
// })

export const calculator = createQuery({
    name: 'calculator',
    initialState: 0 as number,
    reducers: {
        add: (state: number, { payload }:PayloadAction<number>) => state + payload
    },
    effectReducers: {
        fetchOne: {
            request: (payload: number) => new Promise<{ add: number }>((resolve) => resolve({ add: payload })),
            reducer: (state: number, { payload }:PayloadAction<{ add: number }>) => state * payload.add
        }
    },
})

calculator.effects.fetchOne(1)
calculator.actions.fetchOne({ add: 1 })
calculator.actions.add(1)