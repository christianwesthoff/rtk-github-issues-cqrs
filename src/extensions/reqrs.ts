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

export type ExtractReducers<Reducers, State> = {
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
    ReducersWithLoading<ExtractReducers<CaseReducers & EffectCaseReducers, QueryState<State>>, 
    QueryState<State>>, ExtractReducers<EffectCaseReducers, QueryState<State>>, ResultState> {

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
            (effect as any).toString = () => reducerName;
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

/**
 * Reducing helpers
 */
export function filterObject<T, K extends string|number|symbol>(obj:T, keyFn:(key:K) => boolean):T {
    return Object.entries(obj)
        .filter(([key]) => keyFn(key as K))
        .reduce((res, [key, value]) => ({ ...res, [key]: value }), {}) as T;
}

export function assignObjectByArray<T, K extends string|number|symbol>(obj:T, arr:Array<any>, keyFn:(key:any) => K, valFn:(key:any) => any):T {
    return arr.reduce((res, entry) => ({ ...res, [keyFn(entry)]: valFn(entry) }), obj);
}

export function arrayToObject<T, K extends string|number|symbol>(arr:Array<any>, keyFn:(key:any) => K, valFn:(key:any) => any):T {
    return arr.reduce((res, entry) => ({ ...res, [keyFn(entry)]: valFn(entry) }), {});
}

export function appendIfNotExists<T>(arr:Array<T>, entries:Array<T>):Array<T> {
    return arr.concat(entries.filter(entry => !arr.includes(entry)));
}

/**
 * State normalization
 */
export interface NormalizedState<State, Key extends string|number|symbol> {
    byId: Record<Key, State>
    allIds: Array<Key>
}

export type NormalizedStateReducers<Payload, State, Key extends string|number|symbol> = {
    effectReducers: {
        retrieveAll: CaseReducer<NormalizedState<State, Key>, PayloadAction<Array<Payload>>>,
        retrieveMany: CaseReducer<NormalizedState<State, Key>, PayloadAction<Array<Payload>>>
        retrieveOne: CaseReducer<NormalizedState<State, Key>, PayloadAction<Payload>>
    },
    reducers: {
        removeAll:  CaseReducer<NormalizedState<State, Key>>,
        removeMany:  CaseReducer<NormalizedState<State, Key>, PayloadAction<Array<Key>>>
        removeOne:  CaseReducer<NormalizedState<State, Key>, PayloadAction<Key>>
    }
}

export function createNormalizedStateReducers<Payload, State, Key extends string|number|symbol>(
        payloadToState:(payload:Payload) => State, 
        payloadToKey:(payload:Payload) => Key
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
                state.byId = assignObjectByArray(state.byId, action.payload, payload => payloadToKey(payload), payload => payloadToState(payload));
                state.allIds = appendIfNotExists(state.allIds, action.payload.map(payload => payloadToKey(payload)) as any);
            },
            retrieveOne: function(state, action) {
                state.byId = assignObjectByArray(state.byId, [action.payload], payload => payloadToKey(payload), payload => payloadToState(payload));
                state.allIds = appendIfNotExists(state.allIds, [payloadToKey(action.payload) as any]);
            }
        }
    }
}

export function createInitalNormalizedState<State, Key extends string|number|symbol>():NormalizedState<State, Key> {
    return {
        byId: {} as Record<Key, State>,
        allIds: [] as Array<Key>
    };
}


// TODO: Connect query to commands
// export function createCommand(query, ) {

// }


// Test of type safety

interface Test {
    id: string;
    test: string
}

const initalState = createInitalNormalizedState<Test, string>();
const { reducers, effectReducers } = createNormalizedStateReducers<Test, Test, string>(payload => payload, payload => payload.id);

const query = createQuery({
    name: 'hallo',
    initialState: initalState,
    request: () => new Promise((resolve) => {
        resolve("Hello World");
    }),
    reducers,
    effectReducers
});