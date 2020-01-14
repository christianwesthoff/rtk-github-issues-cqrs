import { ThunkAction } from 'redux-thunk'
import { Action, PayloadAction } from '@reduxjs/toolkit'

export type CaseReducerEffects<P, S> = {
    [T in keyof P]: EffectCreatorForCaseReducer<P[T], S>
}

interface EffectCreatorWithPayload<P, S> {
    <PT extends P>(payload: PT): ThunkAction<void, S, null, Action<string>>;
    (payload: P): ThunkAction<void, S, null, Action<string>>;
}

type EffectCreatorForCaseReducer<CR, S> = CR extends (state: any, action: infer Action) => any ? Action extends {
    payload: infer P;
} ? EffectCreatorWithPayload<P, S> : unknown : unknown


type Test = CaseReducerEffects<{ test: (state: any, action: PayloadAction<Array<string>>) => {}, 
test1: (state: any, action: PayloadAction<number>) => {} }, any>;

const test = (test:Test) => test.test1(1)