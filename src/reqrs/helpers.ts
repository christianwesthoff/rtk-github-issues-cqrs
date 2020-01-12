export function enhanceFunction<T extends Function>(fn:T, name:string):T {
    fn.toString = () => name;
    return fn;
}

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