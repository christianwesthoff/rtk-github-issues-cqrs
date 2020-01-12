import { 
    Action, SliceCaseReducers, Slice, CaseReducer, PayloadAction, createSlice
 } from '@reduxjs/toolkit'
import { ThunkAction } from 'redux-thunk'
import { RequestException, Request } from './request';
// TODO: Connect query to commands

export interface CommandOptions {
    name: string, 
    request: Request,
    connectQueryEffect: (payload:any) => ThunkAction<void, any, null, Action<string>>,
}

export interface CommandSlice<ResultState = any> extends Slice<CommandState, CommandReducers>{
    effects: {
        create: ThunkAction<void, ResultState, null, Action<string>>
    }
}

export interface CommandState {
    isSuccess: boolean
    isLoading: boolean;
    errors: Array<string>|null;
}

export interface CommandReducers extends SliceCaseReducers<CommandState> {
    loadingStart: CaseReducer<CommandState>,
    loadingSuccess: CaseReducer<CommandState, PayloadAction<any>>,
    loadingFailed: CaseReducer<CommandState, PayloadAction<any>>,
    loadingReset: CaseReducer<CommandState>
}

export function createCommand<ResultState = any>(options:CommandOptions):CommandSlice<ResultState> {
    const { name, request, connectQueryEffect } = options;
    
    const initalState: CommandState = {
        isSuccess: false,
        isLoading: false,
        errors: null
    };

    const slice = createSlice({
        name,
        initialState: initalState,
        reducers: {
          loadingStart: (state: CommandState) => {
            state.isLoading = true;
            state.isSuccess = false;
            state.errors = null;
          },
          loadingFailed: (state: CommandState, action: PayloadAction<Array<string>>) => {
            state.isLoading = false;
            state.errors = action.payload;
          },
          loadingSuccess: (state: CommandState) => {
            state.isLoading = false;
            state.isSuccess = true;
            state.errors = null;
          },
          loadingReset: (state: CommandState) => {
            state.isLoading = false;
            state.isSuccess = false;
            state.errors = null;
          }
        }
    });

    return {
        name: slice.name, 
        reducer: slice.reducer, 
        caseReducers: slice.caseReducers as any, 
        actions: slice.actions as any, 
        effects: {
            create: () => (
                payload: any,
            ): ThunkAction<void, ResultState, null, Action<string>> => async dispatch => {
                try {
                    dispatch(slice.actions.loadingStart());
                    const response: any = await request(payload);
                    dispatch(slice.actions.loadingSuccess());
                    dispatch(connectQueryEffect({ ...payload, ...response }));
                } catch (err) {
                    dispatch(slice.actions.loadingFailed((err as RequestException).errors));
                    throw err;
                }
            }
        }
    }
}
