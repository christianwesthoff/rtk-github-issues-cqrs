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
  CR extends SliceCaseReducers<QueryState<State>> = SliceCaseReducers<QueryState<State>>,
  CR1 extends SliceCaseReducers<QueryState<State>> = SliceCaseReducers<QueryState<State>>
> {
    name: string, 
    initialState: State, 
    request: (action: string, payload:any) => Promise<any>,
    reducers?: ValidateSliceCaseReducers<QueryState<State>, CR>,
    effectReducers?: ValidateSliceCaseReducers<QueryState<State>, CR1>
}

export interface QuerySlice<
  State = any,
  CaseReducers extends SliceCaseReducersWithLoading<QueryState<State>> = SliceCaseReducersWithLoading<QueryState<State>>,
  EffectCaseReducers extends SliceCaseReducers<QueryState<State>> = SliceCaseReducers<QueryState<State>>,
  ResultState = any
> extends Slice<QueryState<State>, CaseReducers>{
    effects: {
        [Type in keyof EffectCaseReducers]: ThunkAction<void, ResultState, null, Action<string>>
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
    EffectCaseReducers extends SliceCaseReducers<QueryState<State>>, 
    ResultState = any>(
        options: QueryOptions<State, CaseReducers, EffectCaseReducers>
    ): QuerySlice<QueryState<State>, ReducersWithLoading<CaseReducers & EffectCaseReducers, QueryState<State>>, EffectCaseReducers, ResultState> {

    const { name, initialState, request, reducers, effectReducers } = options;

    // monkeypatch reducers
    const enhanceReducers = (reducers:SliceCaseReducers<QueryState<State>>):SliceCaseReducers<QueryState<State>> => 
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

    const enhancedReducers = effectReducers && enhanceReducers(effectReducers) || {};
    const slice = createSlice<QueryState<State>, SliceCaseReducersWithLoading<QueryState<State>>>({
        name,
        initialState: initalStateWithLoading,
        reducers: {
            ...enhancedReducers,
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
    if (effectReducers) {
        Object.keys(effectReducers).forEach(reducerName => {
            const effect = createEffect(reducerName);
            // enhance thunks
            (effect as any).toString = () => reducerName;
            effects[reducerName] = effect;
        });
    }

    return { 
        name: slice.name, 
        reducer: slice.reducer, 
        actions: slice.actions as any, 
        caseReducers: slice.caseReducers as any, 
        effects: effects as any 
    };
};

/**
 * Reducing helpers
 */
export function filterObject(obj:any, keyFn:(key:any) => boolean):any {
    return Object.entries(obj)
        .filter(([key]) => keyFn(key))
        .reduce((res, [key, value]) => ({ ...res, [key]: value }), {});
}

export function assignObject(obj:any, arr:Array<any>, keyFn:(key:any) => any, valFn:(key:any) => any):any {
    return arr.map(entry => (obj[keyFn(entry)] = valFn(entry)));
}

export function arrayToObject(arr:Array<any>, keyFn:(key:any) => any, valFn:(key:any) => any):any {
    return arr.reduce((res, entry) => ({ ...res, [keyFn(entry)]: valFn(entry) }), {});
}

export function appendIfNotExists(arr:Array<any>, entries:Array<any>):Array<any> {
    return arr.concat(entries.filter(entry => !arr.includes(entry)));
}

/**
 * State normalization
 */
export interface NormalizedState<Key extends string|number|symbol, State> {
    byId: Record<Key, State>
    allIds: Array<Key>
}

export type NormalizedStateReducers<Payload, State, Key extends string|number|symbol> = {
    effectReducers: {
        retrieveAll: CaseReducer<NormalizedState<Key, State>, PayloadAction<Array<Payload>>>,
        retrieveMany: CaseReducer<NormalizedState<Key, State>, PayloadAction<Array<Payload>>>
        retrieveOne: CaseReducer<NormalizedState<Key, State>, PayloadAction<Payload>>
    },
    reducers: {
        removeAll:  CaseReducer<NormalizedState<Key, State>>,
        removeMany:  CaseReducer<NormalizedState<Key, State>, PayloadAction<Array<Key>>>
        removeOne:  CaseReducer<NormalizedState<Key, State>, PayloadAction<Key>>
    }
}

export function createNormalizedStateReducers<Payload, State, Key extends string|number|symbol>(
        payloadToState:(payload:Payload|Array<Payload>) => State, 
        payloadToKey:(payload:Payload|Array<Payload>) => Key
    ): NormalizedStateReducers<Payload, State, Key> {
    return {
        reducers: {
            removeAll: function(state) {
                state.byId = {} as any;
                state.allIds = [];
            },
            removeMany: function(state, action) {
                state.byId = filterObject(state.byId, id => !action.payload.includes(id as Key));
                state.allIds = state.allIds.filter(id => !action.payload.includes(id as Key));
            },
            removeOne: function(state, action) {
                state.byId = filterObject(state.byId, id => action.payload !== id)
                state.allIds = state.allIds.filter(id => id !== action.payload);
            }
        },
        effectReducers: {
            retrieveAll: function(state, action) {
                state.byId = arrayToObject(action.payload, payload => payloadToKey(payload), payload => payloadToState(payload));
                state.allIds = action.payload.map(payload => payloadToKey(payload) as any);
            },
            retrieveMany: function(state, action) {
                state.byId = assignObject(state.byId, action.payload, payload => payloadToKey(payload), payload => payloadToState(payload));
                state.allIds = appendIfNotExists(state.allIds, action.payload.map(payload => payloadToKey(payload)));
            },
            retrieveOne: function(state, action) {
                state.byId = assignObject(state.byId, [action.payload], payload => payloadToKey(payload), payload => payloadToState(payload));
                state.allIds = appendIfNotExists(state.allIds, [payloadToKey(action.payload)]);
            }
        }
    }
}

// TODO: Connect query to commands
// export function createCommand(query, ) {

// }

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