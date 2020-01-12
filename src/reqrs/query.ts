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

export interface QueryOptions<
  State,
  CaseReducers extends SliceCaseReducers<State> = SliceCaseReducers<State>,
  EffectCaseReducers extends SliceCaseReducers<State> = SliceCaseReducers<State>
> {
    name: string, 
    initialState: State, 
    request: (action: string, payload:any) => Promise<any>,
    reducers?: ValidateSliceCaseReducers<State, CaseReducers>,
    effectReducers?: ValidateSliceCaseReducers<State, EffectCaseReducers>
}

export interface QuerySlice<
  State = any,
  CaseReducers extends SliceCaseReducersWithLoading<State> = SliceCaseReducersWithLoading<State>,
  EffectCaseReducers extends SliceCaseReducers<State> = SliceCaseReducers<State>,
  ResultState = any
> extends Slice<State, CaseReducers>{
    effects: {
        [Type in keyof EffectCaseReducers]: ThunkAction<void, ResultState, null, Action<string>>
    }
}

interface LoadingReducers<State> {
    loadingStart: CaseReducer<State>,
    loadingFailed: CaseReducer<State, PayloadAction<any>>,
    loadingReset: CaseReducer<State>
}

export type SliceCaseReducersWithLoading<State> = SliceCaseReducers<State> & LoadingReducers<State>;

interface InternalQueryState {
    isLoading: boolean;
    error: string|null;
}

export type QueryState<State> = State & InternalQueryState;

export type ReducersWithLoading<Reducers, State> = Reducers & LoadingReducers<State>;

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
                state.error = null;
            }
        }), {});

    const initalStateWithLoading: QueryState<State> = {
        ...initialState,
        isLoading: false,
        error: null
    };

    const enhancedReducers = effectReducers && enhanceReducers(effectReducers) || {};
    const slice = createSlice<QueryState<State>, SliceCaseReducersWithLoading<QueryState<State>>>({
        name,
        initialState: initalStateWithLoading,
        reducers: {
            ...enhancedReducers,
          loadingStart: (state: InternalQueryState) => {
            state.isLoading = true;
            state.error = null;
          },
          loadingFailed: (state: InternalQueryState, action: PayloadAction<string>) => {
            state.isLoading = false;
            state.error = action.payload;
          },
          loadingReset: (state: InternalQueryState) => {
            state.isLoading = false;
            state.error = null;
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
            const result = await request(actionName, payload);
            dispatch(slice.actions[actionName](result));
        } catch (err) {
            dispatch(slice.actions.loadingFailed(err));
        }
    };

    const effects: Record<string, Function> = {};
    if (effectReducers) {
        Object.keys(effectReducers).forEach(reducerName => {
            const effect = createEffect(reducerName);
            // enhance thunks
            enhanceFunction(effect, reducerName);
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


// TODO: Connect query to commands
// export function createCommand(query, ) {

// }

