import { 
    createSlice, 
    PayloadAction,
    CaseReducer, 
    SliceCaseReducers, 
    Action, 
    Slice, 
    ValidateSliceCaseReducers
 } from '@reduxjs/toolkit'
import { ThunkAction } from 'redux-thunk'

export interface QueryOptions<
  State,
  CR extends SliceCaseReducers<State> = SliceCaseReducers<State>,
  CR1 extends SliceCaseReducers<State> = SliceCaseReducers<State>
> {
    name: string, 
    initialState: State, 
    request: (action: string, payload:any) => Promise<any>,
    reducers?: ValidateSliceCaseReducers<State, CR>,
    effectReducers?: ValidateSliceCaseReducers<State, CR1>
}

export interface QuerySlice<
  State = any,
  CaseReducers extends SliceCaseReducersWithLoading<State> = SliceCaseReducersWithLoading<State>,
  CaseReducersForThunks = any,
  ResultState = any
> extends Slice<State, CaseReducers>{
    effects: {
        [Type in keyof CaseReducersForThunks]: ThunkAction<void, ResultState, null, Action<string>>
    }
}

interface LoadingReducers<State> {
    startLoading: CaseReducer<State>,
    loadingFailed: CaseReducer<State, PayloadAction<any>>,
    resetLoading: CaseReducer<State>
}

export type SliceCaseReducersWithLoading<State> = SliceCaseReducers<State> & LoadingReducers<State>;

interface InternalQueryState {
    isLoading: boolean;
    error: string|null;
}

export type QueryState<State> = State & InternalQueryState;

export type ReducersWithLoading<Reducers, State> = Reducers & LoadingReducers<State>;

export function createQuery<
    State, 
    CaseReducers extends SliceCaseReducers<QueryState<State>>,
    CaseReducers1 extends SliceCaseReducers<QueryState<State>>, 
    ResultState = any>(
        options: QueryOptions<State, CaseReducers, CaseReducers1>
    ): QuerySlice<QueryState<State>, ReducersWithLoading<CaseReducers & CaseReducers1, QueryState<State>>, CaseReducers1, ResultState> {

    const { name, initialState, request, reducers, effectReducers } = options;

    // monkeypatch reducers
    const enhanceReducers = (reducers:SliceCaseReducers<State>):SliceCaseReducers<QueryState<State>> => 
        Object.keys(reducers).reduce((result:any, reducerName) => {
            result[reducerName] = (state: QueryState<State>, payload: PayloadAction<any>) => 
            {
                state.isLoading = false;
                state.error = null;
                return (reducers as any)[reducerName](state, payload);
            }
        }, {});

    const initalStateWithLoading: QueryState<State> = {
        ...initialState,
        isLoading: false,
        error: null
    };

    const slice = createSlice<QueryState<State>, SliceCaseReducersWithLoading<QueryState<State>>>({
        name,
        initialState: initalStateWithLoading,
        reducers: {
          ...enhanceReducers(effectReducers),
          startLoading: (state: InternalQueryState) => {
            state.isLoading = true;
            state.error = null;
          },
          loadingFailed: (state: InternalQueryState, action: PayloadAction<string>) => {
            state.isLoading = false;
            state.error = action.payload;
          },
          resetLoading: (state: InternalQueryState) => {
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
            dispatch(slice.actions.startLoading());
            const result = await request(actionName, payload);
            dispatch(slice.actions[actionName](result));
        } catch (err) {
            dispatch(slice.actions.loadingFailed(err));
        }
    };

    const effects: Record<string, Function> = {};
    Object.keys(effectReducers).forEach(reducerName => {
        const effect = createEffect(reducerName);
        // enhance thunks
        (effect as any).toString = () => reducerName;
        effects[reducerName] = effect;
    });

    return { 
        name: slice.name, 
        reducer: slice.reducer, 
        actions: slice.actions as any, 
        caseReducers: slice.caseReducers as any, 
        effects: effects as any 
    };
};

/**
 * State normalization
 */
export interface NormalizedState<Key extends string|number|symbol, State> {
    byId: Record<Key, State>
    allIds: Array<Key>
}

export interface PessimisticNormalizedStateReducers<Key extends string|number|symbol, Payload, State> {
    fetchAll: CaseReducer<NormalizedState<Key, State>, PayloadAction<Array<Payload>>>,
    fetchBy: CaseReducer<NormalizedState<Key, State>, PayloadAction<Payload>>,
    removeAll:  CaseReducer<NormalizedState<Key, State>>,
    removeBy:  CaseReducer<NormalizedState<Key, State>, PayloadAction<Key>>,
}

// TODO: Connect query to commands
export function createCommand(query, ) {

}

interface Test {
    test: string
}

const test: Test = {
    test: ''
}

const query = createQuery({
    name: 'hallo',
    initialState: test,
    request: () => new Promise((resolve) => {
        resolve("Hello World");
    }),
    effectReducers: {
        test: function(state:QueryState<Test>, payload:PayloadAction<string>) {
            state.test = payload.payload;
        }
    }
});