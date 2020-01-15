import { Middleware, MiddlewareAPI, Dispatch, PayloadAction } from "@reduxjs/toolkit";
import { ThunkDispatch } from "redux-thunk"

export type Dispatcher<P, S, RS> = (dispatch: ThunkDispatch<S, null, any>, payload:P, state: RS) => void;
export type SubscriptionFilter = <Payload>(payload:Payload) => boolean;

export interface SubscriptionOptions<P, S, RS> {
    action: string,
    dispatcher: Dispatcher<P, S, RS>,
}

type SubscriptionRegistry = Record<string, Array<Dispatcher<any, any, any>>>;

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

export const useSubscription = <P, S, RS>(options: SubscriptionOptions<P, S, RS>):() => void => {
    const { action, dispatcher } = options;
    subscriptionRegistry[action] = (subscriptionRegistry[action] || []).concat([dispatcher]);
    return () => {
        subscriptionRegistry[action] = subscriptionRegistry[action].filter(subscribe => subscribe !== dispatcher);
    }
}