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
  Thunks = any,
  ResultState = any
> extends Slice<State, CaseReducers>{
    effects: {
        [Type in keyof Thunks]: ThunkAction<void, ResultState, null, Action<string>>
    }
}

export type LoadingReducers<State> = {
    startLoading: CaseReducer<State>,
    loadingFailed: CaseReducer<State, PayloadAction<any>>,
    resetLoading: CaseReducer<State>
}

export type SliceCaseReducersWithLoading<State> = SliceCaseReducers<State> & LoadingReducers<State>;

export type QueryState<State> = State & QueryStatus;

export interface QueryStatus {
    isLoading: boolean;
    error: string|null;
}

export type ReducersWithLoading<Reducers, State> = Reducers & LoadingReducers<State>;

export function createQuery<
    State, 
    CaseReducers extends SliceCaseReducers<QueryState<State>>, 
    ResultState = any>(
        options: QueryOptions<State, CaseReducers>
    ): QuerySlice<QueryState<State>, ReducersWithLoading<CaseReducers, QueryState<State>>, CaseReducers, ResultState> {

    const { name, initialState, request, reducers } = options;

    const prepareReducers = (reducers:any):SliceCaseReducers<QueryState<State>> => Object.assign({}, 
        ...Object.keys(reducers).map(reducer => ({ [reducer]: function (state: QueryState<State>, payload: PayloadAction<any>) {
            state.isLoading = false,
            state.error = null
            return reducers[reducer](state, payload);
        } })));

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
          startLoading: function(state: QueryStatus) {
            state.isLoading = true,
            state.error = null
          },
          loadingFailed: function (state: QueryStatus, action: PayloadAction<string>) {
            state.isLoading = false;
            state.error = action.payload;
          },
          resetLoading: function(state: QueryStatus) {
            state.isLoading = false,
            state.error = null
          },
        }
    });

    const effects: Record<string, Function> = {};
    const extraReducerNames = Object.keys(reducers);

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

    extraReducerNames.forEach(reducerName => {
        effects[reducerName] = createEffect(reducerName);
    });

    return { 
        name: slice.name, 
        reducer: slice.reducer, 
        actions: slice.actions as any, 
        caseReducers: slice.caseReducers as any, 
        effects: effects as any 
    };
};

interface Test {
    test: string
}

const test: Test = {
    test: ''
}

const query = createQuery({
    name: 'hallo',
    initialState: test,
    reducers: {
        test: function(state:QueryState<Test>, payload:PayloadAction<string>) {
            state.test = payload.payload;
        }
    },
    request: () => new Promise((resolve, reject) => {
        resolve("Hello World");
    })
});
