import { 
    PayloadAction,
    CaseReducer, 
 } from '@reduxjs/toolkit'
import { filterObject, arrayToObject, extendObjectByArray, appendIfNotExists } from './helpers';

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
        removeAll: CaseReducer<NormalizedState<State, Key>>,
        removeMany: CaseReducer<NormalizedState<State, Key>, PayloadAction<Array<Key>>>
        removeOne: CaseReducer<NormalizedState<State, Key>, PayloadAction<Key>>
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
                state.byId = extendObjectByArray(state.byId, action.payload, payload => payloadToKey(payload), payload => payloadToState(payload));
                state.allIds = appendIfNotExists(state.allIds, action.payload.map(payload => payloadToKey(payload)) as any);
            },
            retrieveOne: function(state, action) {
                state.byId = extendObjectByArray(state.byId, [action.payload], payload => payloadToKey(payload), payload => payloadToState(payload));
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