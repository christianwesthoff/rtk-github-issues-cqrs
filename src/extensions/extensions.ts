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
  CR extends SliceCaseReducers<State> = SliceCaseReducers<State>
> {
    name: string, 
    initialState: State, 
    request: (payload:any) => Promise<any>,
    reducers: ValidateSliceCaseReducers<State, CR>
}

export interface QuerySlice<
  State = any,
  CaseReducers extends SliceCaseReducersWithLoading<State> = SliceCaseReducersWithLoading<State>,
  CaseReducersForThunks = any,
  ResultState = any
> extends Slice<State, CaseReducers>{
    effects: {
        [Type in keyof CaseReducersForThunks]: EnhancedThunkAction<void, ResultState, null, Action<string>>
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

export interface EnhancedThunkAction<R, S, E, A extends Action<any>> extends ThunkAction<R, S, E, A>, Function {};

export function createQuery<
    State, 
    CaseReducers extends SliceCaseReducers<QueryState<State>>, 
    ResultState = any>(
        options: QueryOptions<State, CaseReducers>
    ): QuerySlice<QueryState<State>, ReducersWithLoading<CaseReducers, QueryState<State>>, CaseReducers, ResultState> {

    const { name, initialState, request, reducers } = options;

    // monkeypatch reducers
    const prepareReducers = (reducers:any):SliceCaseReducers<QueryState<State>> => 
        Object.keys(reducers).reduce((result:any, reducerName:string) => {
            result[reducerName] = (state: QueryState<State>, payload: PayloadAction<any>) => 
            {
                state.isLoading = false;
                state.error = null;
                return reducers[reducerName](state, payload);
            }
        }, {});

    const initalStateWithLoading: QueryState<State> = {
        ...initialState,
        isLoading: false,
        error: null
    }

    const slice = createSlice<QueryState<State>, SliceCaseReducersWithLoading<QueryState<State>>>({
        name,
        initialState: initalStateWithLoading,
        reducers: {
          ...prepareReducers(reducers),
          startLoading: (state: InternalQueryState) => {
            state.isLoading = true,
            state.error = null
          },
          loadingFailed: (state: InternalQueryState, action: PayloadAction<string>) => {
            state.isLoading = false;
            state.error = action.payload;
          },
          resetLoading: (state: InternalQueryState) => {
            state.isLoading = false,
            state.error = null
          },
        }
    });

    const createEffect = (actionName:string) => (
        payload: any,
    ): ThunkAction<void, ResultState, null, Action<string>> => async dispatch => {
        try {
            dispatch(slice.actions.startLoading())
            const result = await request(payload);
            dispatch(slice.actions[actionName](result))
        } catch (err) {
            dispatch(slice.actions.loadingFailed(err));
        }
    }

    const effects: Record<string, Function> = {};
    Object.keys(reducers).forEach(reducerName => {
        const effect = createEffect(reducerName);
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
    reducers: {
        test: function(state:QueryState<Test>, payload:PayloadAction<string>) {
            state.test = payload.payload;
        }
    },
});



