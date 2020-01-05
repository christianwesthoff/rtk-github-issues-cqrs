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

export interface QueryState {
    isLoading: boolean;
    error: string|null;
}

export interface QueryOptions<
  State extends QueryState = any,
  CR extends SliceCaseReducers<State> = SliceCaseReducers<State>
> {
    name: string, 
    initialState: State, 
    fetch: (payload:any) => Promise<any>,
    reducers: ValidateSliceCaseReducers<State, CR>
}

export interface QuerySlice<
  State = any,
  CaseReducers extends SliceCaseReducersWithLoadingStates<State> = SliceCaseReducersWithLoadingStates<State>,
  ResultState = any
> extends Slice<State, CaseReducers>{
    effects: {
        [Type in keyof CaseReducers]: ThunkAction<void, ResultState, null, Action<string>>
    }
}

export type SliceCaseReducersWithLoadingStates<State> = {
    [K: string]:
      | CaseReducer<State, PayloadAction<any>>
      | CaseReducerWithPrepare<State, PayloadAction<any>>,
    ["startLoading"]: CaseReducer<State>,
    ["loadingFailed"]: CaseReducer<State, PayloadAction<any>>,
    ["resetLoading"]: CaseReducer<State>,
  }

export function createQuery<
    State extends QueryState, 
    CaseReducers extends SliceCaseReducers<State>, ResultState>(
        options: QueryOptions<State, CaseReducers>
    ): QuerySlice<State, SliceCaseReducersWithLoadingStates<State>> {

    const { name, initialState, fetch, reducers } = options;

    const prepareReducers = (reducers:any):SliceCaseReducers<State> => Object.assign({}, 
        ...Object.keys(reducers).map(reducer => ({ [reducer]: function (state: QueryState, payload: PayloadAction<any>) {
            state.isLoading = false,
            state.error = null
            return reducers[reducer](state, payload);
        } })));

    const slice = createSlice<State, SliceCaseReducersWithLoadingStates<State>>({
        name,
        initialState,
        reducers: {
          ...prepareReducers(reducers),
          startLoading: function(state: QueryState) {
            state.isLoading = true,
            state.error = null
          },
          loadingFailed: function (state: QueryState, action: PayloadAction<string>) {
            state.isLoading = false;
            state.error = action.payload;
          },
          resetLoading: function(state: QueryState) {
            state.isLoading = false,
            state.error = null
          },
        }
    });

    const { startLoading, loadingFailed } = slice.actions;
    const effects: Record<string, Function> = {};
    const extraReducerNames = Object.keys(reducers);

    const createEffect = (actionName:string) => (
        payload: any,
    ): ThunkAction<void, ResultState, null, Action<string>> => async dispatch => {
        try {
            dispatch(startLoading())
            const result = await fetch(payload);
            dispatch(slice.actions[actionName](result))
        } catch (err) {
            dispatch(loadingFailed(err));
        }
    }

    extraReducerNames.forEach(reducerName => {
        effects[reducerName] = createEffect(reducerName);
    });

    return { ...slice, effects: effects as any };
};