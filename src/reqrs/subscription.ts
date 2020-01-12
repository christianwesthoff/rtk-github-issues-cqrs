import { Middleware, MiddlewareAPI, Dispatch, PayloadAction } from "@reduxjs/toolkit";

export type Dispatcher = <Payload>(dispatch: Dispatch, payload:Payload) => void;
export type SubscriptionFilter = <Payload>(payload:Payload) => boolean;

export interface Subscription {
    actionName: string,
    stage: 'before'|'after',
    dispatcher: Dispatcher,
    filter?: SubscriptionFilter
}

type SubscriptionEntry = {
    before: Subscription[],
    after: Subscription[]
}

type SubscriptionRegistry = Record<string, SubscriptionEntry>;

const subscriptionRegistry:SubscriptionRegistry = {};

export const subscriptionMiddleware: Middleware =
  (api: MiddlewareAPI) => 
  (next: Dispatch) => 
  <A extends PayloadAction<any>>(action: A) => {
    const { type, payload } = action;
    const subscriptions = subscriptionRegistry[type];
    if (!!subscriptions && !!subscriptions.before) {
        subscriptions
            .before
            .filter(({ filter }) => (filter ? filter(payload) : true))
            .forEach(({ dispatcher }) => dispatcher(api.dispatch, payload));
    }
    const dispatch = next(action);
    if (!!subscriptions && !!subscriptions.after) {
        subscriptions
            .after
            .filter(({ filter }) => (filter ? filter(payload) : true))
            .forEach(({ dispatcher }) => dispatcher(api.dispatch, payload));
    }
    return dispatch;
  };

export const useSubscription = (options: Subscription):void => {
    const { actionName, stage } = options;
    subscriptionRegistry[actionName][stage] = ((subscriptionRegistry as any)[stage][actionName] || []).concat([options]);
}