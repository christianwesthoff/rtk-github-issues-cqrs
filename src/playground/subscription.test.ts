import { useSubscription } from "./subscription";
import { calculator } from "./query.test";

useSubscription({ action: 'test/update', dispatcher: (dispatch, payload) => {
    dispatch(calculator.effects.fetchOne(1));
    dispatch(calculator.actions.fetchOne({ add: 1 }));
}});