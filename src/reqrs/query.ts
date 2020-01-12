import { 
    createSlice, 
    PayloadAction,
    CaseReducer, 
    SliceCaseReducers, 
    CaseReducerWithPrepare,
    Action, 
    Slice, 
    ValidateSliceCaseReducers
 } from '@reduxjs/toolkit'
import { ThunkAction } from 'redux-thunk'
import { enhanceFunction } from "./helpers";
import { RequestException, Request } from './request';

export interface QueryOptions<
  State,
  CaseReducers extends SliceCaseReducers<State> = SliceCaseReducers<State>,
  EffectCaseReducers extends SliceCaseReducers<State> = SliceCaseReducers<State>
> {
    name: string, 
    initialState: State, 
    request: Request,
    reducers?: ValidateSliceCaseReducers<State, CaseReducers>,
    effectReducers?: ValidateSliceCaseReducers<State, EffectCaseReducers>
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
  EffectCaseReducers extends SliceCaseReducers<State> = SliceCaseReducers<State>,
  ResultState = any
> extends Slice<State, CaseReducers>{
    effects: {
        [Type in keyof EffectCaseReducers]: (payload: any) => ThunkAction<void, ResultState, null, Action<string>>
    }
}

interface InternalQueryState {
    isLoading: boolean;
    errors: Array<string>|null;
}

export type QueryState<State> = State & InternalQueryState;

export type ReducersWithLoading<Reducers, State> = Reducers & QueryReducers<State>;

export type RemapReducers<Reducers, State> = {
    [Type in keyof Reducers]: 
        | CaseReducer<State, PayloadAction<any>>
        | CaseReducerWithPrepare<State, PayloadAction<any>>
}

export function createQuery<
    State, 
    CaseReducers extends SliceCaseReducers<State>,
    EffectCaseReducers extends SliceCaseReducers<State>, 
    ResultState = any>(
        options: QueryOptions<State, CaseReducers, EffectCaseReducers>
    ): QuerySlice<QueryState<State>, 
    ReducersWithLoading<RemapReducers<CaseReducers & EffectCaseReducers, QueryState<State>>, 
    QueryState<State>>, RemapReducers<EffectCaseReducers, QueryState<State>>, ResultState> {

    const { name, initialState, request, reducers, effectReducers } = options;

    // monkeypatch reducers
    const enhanceReducers = (reducers:SliceCaseReducers<State>):SliceCaseReducers<QueryState<State>> => 
        Object.keys(reducers).reduce((res:any, reducerName) => ({ ...res, 
            [reducerName]: (state: QueryState<State>, payload: PayloadAction<any>) => 
            {
                (reducers as any)[reducerName](state, payload);
                state.isLoading = false;
                state.errors = null;
            }
        }), {});

    const initalStateWithLoading: QueryState<State> = {
        ...initialState,
        isLoading: false,
        errors: null
    };

    const enhancedReducers = effectReducers && enhanceReducers(effectReducers) || {};
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
    const createEffect = (actionName:string) => (
        payload: any,
    ): ThunkAction<void, ResultState, null, Action<string>> => async dispatch => {
        try {
            dispatch(slice.actions.loadingStart());
            const response: any = await request(payload, actionName);
            dispatch(slice.actions[actionName]({ ...payload, ...response }));
        } catch (err) {
            dispatch(slice.actions.loadingFailed((err as RequestException).errors));
            throw err;
        }
    };

    const effects: Record<string, Function> = {};
    if (effectReducers) {
        Object.keys(effectReducers).forEach(reducerName => {
            const effect = createEffect(reducerName);
//            enhanceFunction(effect, reducerName);
            effects[reducerName] = effect;
        });
    }

    return { 
        name: slice.name, 
        reducer: slice.reducer, 
        caseReducers: slice.caseReducers as any, 
        actions: slice.actions as any, 
        effects: effects as any 
    };
};