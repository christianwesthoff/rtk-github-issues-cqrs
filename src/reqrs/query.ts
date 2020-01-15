import { 
    createSlice, 
    PayloadAction,
    CaseReducer, 
    SliceCaseReducers, 
    CaseReducerWithPrepare,
    Action, 
    Slice, 
    ValidateSliceCaseReducers,
    PrepareAction
 } from '@reduxjs/toolkit'
import { ThunkAction } from 'redux-thunk'
import { RequestException } from './request';

export declare type Request<R = any, P = any> = (payload:P) => Promise<R>

export declare type CaseReducerWithRequest<State, Action extends PayloadAction> = {
    request: Request,
    reducer: CaseReducer<State, Action>;
};

export declare type SliceCaseEffectReducers<State> = {
    [K: string]: CaseReducerWithRequest<State, PayloadAction<any>>;
};

export declare type ValidateSliceEffectCaseReducers<S, ACR extends SliceCaseEffectReducers<S>> = ACR & {
    [P in keyof ACR]: ACR[P] extends {
        request(payload: any): Promise<infer O>;
    } ? {
        reducer(s: S, action?: {
            payload: O;
        }): any;
    } : unknown;
};

export type CaseReducerEffects<P, S> = {
    [T in keyof P]: P[T] extends {
        request(payload: infer O): any;
    } ? EffectCreatorWithPayload<O, S> : unknown
}

export interface EffectCreatorWithPayload<P, S> {
    <PT extends P>(payload: PT): ThunkAction<void, S, null, Action<string>>;
    (payload: P): ThunkAction<void, S, null, Action<string>>;
    (): ThunkAction<void, S, null, Action<string>>;
}

export interface QueryOptions<
  State,
  CaseReducers extends SliceCaseReducers<State> = SliceCaseReducers<State>,
  EffectCaseReducers extends SliceCaseEffectReducers<State> = SliceCaseEffectReducers<State>,
> {
    name: string, 
    initialState: State, 
    request?: Request,
    reducers?: ValidateSliceCaseReducers<State, CaseReducers>,
    effectReducers?: ValidateSliceEffectCaseReducers<State, EffectCaseReducers>
}

export interface QueryReducers<State> {
    loadingStart: CaseReducer<State>,
    loadingFailed: CaseReducer<State, PayloadAction<any>>,
    loadingReset: CaseReducer<State>
}

export type SliceCaseReducersWithLoading<State> = SliceCaseReducers<State> & QueryReducers<State>;

export interface QuerySlice<
  State = any,
  CaseReducers extends SliceCaseReducersWithLoading<State> = SliceCaseReducersWithLoading<State>,
  EffectCaseReducers extends SliceCaseEffectReducers<State> = SliceCaseEffectReducers<State>,
  ResultState = any
> extends Slice<State, CaseReducers>{
    effects: CaseReducerEffects<EffectCaseReducers, ResultState>
}

interface InternalQueryState {
    isLoading: boolean;
    errors: Array<string>|null;
}

export type QueryState<State> = State & InternalQueryState;

export type ReducersWithLoading<Reducers, State> = Reducers & QueryReducers<State>;

export type RemapCaseReducers<S, T extends SliceCaseReducers<S>, RS> = {
    [P in keyof T]: T[P] extends 
        CaseReducer<S, PayloadAction<infer P>> ? CaseReducer<RS, PayloadAction<P>> : 
        CaseReducerWithPrepare<RS, PayloadAction<any>>
}

export type RemapCaseEffectReducers<S, T extends SliceCaseEffectReducers<S>, RS> = SliceCaseEffectReducers<any> & {
    [P in keyof T]: {
        request: T[P]["request"]
        reducer: RemapCaseReducers<S, ExportReducers<S, T>, RS>
    }
}

export type ExportReducers<S, T  extends SliceCaseEffectReducers<S>> = {
    [P in keyof T]: T[P]["reducer"]
}

export function createQuery<
    State, 
    CaseReducers extends SliceCaseReducers<State>,
    EffectCaseReducers extends SliceCaseEffectReducers<State>, 
    ResultState = any>(
        options: QueryOptions<State, CaseReducers, EffectCaseReducers>
    ): QuerySlice<QueryState<State>, 
    ReducersWithLoading<RemapCaseReducers<State, CaseReducers & ExportReducers<State, EffectCaseReducers>, QueryState<State>>, QueryState<State>>, 
    RemapCaseEffectReducers<State, EffectCaseReducers, QueryState<State>>, ResultState> {

    const { name, initialState, reducers, effectReducers } = options;

    const extractReducers = (effectReducers:SliceCaseEffectReducers<State>):SliceCaseReducers<State> =>
        Object.keys(effectReducers).reduce((res, name) => ({ ...res, 
            [name]: effectReducers[name].reducer
        }), {});

    // monkeypatch reducers
    const enhanceReducers = (reducers:SliceCaseReducers<State>):SliceCaseReducers<QueryState<State>> => 
        Object.keys(reducers).reduce((res, name) => ({ ...res, 
            [name]: (state: QueryState<State>, payload: PayloadAction<any>) => 
            {
                (reducers as any)[name](state, payload);
                state.isLoading = false;
                state.errors = null;
            }
        }), {});

    const initalStateWithLoading: QueryState<State> = {
        ...initialState,
        isLoading: false,
        errors: null
    };

    const enhancedReducers = effectReducers && enhanceReducers(extractReducers(effectReducers)) || {};
    const slice = createSlice<QueryState<State>, SliceCaseReducersWithLoading<QueryState<State>>>({
        name,
        initialState: initalStateWithLoading,
        reducers: {
            ...enhancedReducers,
          loadingStart: (state: InternalQueryState) => {
            state.isLoading = true;
            state.errors = null;
          },
          loadingFailed: (state: InternalQueryState, action: PayloadAction<Array<string>>) => {
            state.isLoading = false;
            state.errors = action.payload;
          },
          loadingReset: (state: InternalQueryState) => {
            state.isLoading = false;
            state.errors = null;
          },
          ...reducers
        }
    });

    // TODO: type payload
    const createEffect = (name:string, request:Request) => (
        payload: any,
    ): ThunkAction<void, ResultState, null, Action<string>> => async dispatch => {
        try {
            dispatch(slice.actions.loadingStart());
            const response = await request(payload);
            dispatch(slice.actions[name](response));
        } catch (err) {
            dispatch(slice.actions.loadingFailed((err as RequestException).errors));
            throw err;
        }
    };

    const effects: Record<string, Function> = {};
    if (effectReducers) {
        Object.keys(effectReducers).forEach(name => {
            const { request } = effectReducers[name];
            const effect = createEffect(name, request);
            effects[name] = effect;
        });
    }

    return { 
        name: slice.name, 
        reducer: slice.reducer as any, 
        caseReducers: slice.caseReducers as any, 
        actions: slice.actions as any, 
        effects: effects as any 
    };
};