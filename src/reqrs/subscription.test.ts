import { useSubscription } from "./subscription";

useSubscription({ action: 'test/update', stage: 'after', dispatcher: (dispatch, payload) => {}, filter: (payload) => true})