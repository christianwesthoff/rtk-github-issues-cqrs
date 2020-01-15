import { ThunkAction } from 'redux-thunk'
import { Action, PayloadAction } from '@reduxjs/toolkit'

export type CaseReducerEffects<P, S> = {
    [T in keyof P]: P[T] extends {
        request(payload: infer O): any;
    } ? EffectCreatorWithPayload<O, S> : unknown
}

export interface EffectCreatorWithPayload<P, S> {
    <PT extends P>(payload: PT): ThunkAction<void, S, null, Action<string>>;
    (payload: P): ThunkAction<void, S, null, Action<string>>;
}