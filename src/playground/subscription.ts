import { Middleware, MiddlewareAPI, Dispatch, PayloadAction } from "@reduxjs/toolkit";
import { ThunkDispatch } from "redux-thunk"

export type Dispatcher = <Payload, State, GlobalState>(dispatch: ThunkDispatch<State, null, any>, payload:Payload, state: GlobalState) => void;
export type SubscriptionFilter = <Payload>(payload:Payload) => boolean;

export interface SubscriptionOptions {
    action: string,
    dispatcher: Dispatcher,
}

type SubscriptionRegistry = Record<string, Array<Dispatcher>>;

const subscriptionRegistry:SubscriptionRegistry = {};

export const subscriptionMiddleware: Middleware =
  (api: MiddlewareAPI) => 
  (next: Dispatch) => 
  <A extends PayloadAction<any>>(action: A) => {
    const { type, payload } = action;
    const dispatch = next(action);
    if (!!subscriptionRegistry[type]) {
        subscriptionRegistry[type].forEach(dispatcher => dispatcher(api.dispatch, payload, api.getState()));
    }
    return dispatch;
  };

export const useSubscription = (options: SubscriptionOptions):() => void => {
    const { action, dispatcher } = options;
    subscriptionRegistry[action] = (subscriptionRegistry[action] || []).concat([dispatcher]);
    return () => {
        subscriptionRegistry[action] = subscriptionRegistry[action].filter(subscribe => subscribe !== dispatcher);
    }
}