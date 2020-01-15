import { useSubscription } from "./subscription";
import { calculator } from "./query.test";

useSubscription({ action: 'test/update', dispatcher: (dispatch, payload, state) => {
    dispatch(calculator.effects.fetchOne(1))
}})
