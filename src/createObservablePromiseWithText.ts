import { IObservablePromiseWithText } from "./IObservablePromiseWithText";
import { o, co } from "./Observable";

export function createObservablePromiseWithText<T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void, progress: (n: number) => void) => void, errorString: (error:any) => string, text: () => string) {

    var resolve: (value?: T | PromiseLike<T>) => void;
    var reject: (reason?: any) => void;

    var promise = <IObservablePromiseWithText<T>>new Promise((a, b) => {

        resolve = a;
        reject = b;
    });

    promise.error = o(null);
    promise.errorText = co(() => errorString(promise.error.value));
    promise.isErroneous = o(false);
    promise.isFinished = o(false);
    promise.progress = o(0);
    promise.text = co(text);

    executor(
        v => { resolve(v); promise.progress.value = 1; },
        r => { reject(r); promise.error.value = r; promise.isErroneous.value = true; },
        n => { promise.progress.value = n; promise.isFinished.value = true; });

    return promise;
}

export function createObservablePromiseWithTextFromPromise<T>(promise: Promise<T>, errorString: (error:any) => string, text: () => string) {

    return createObservablePromiseWithText<T>((resolve, reject, progress) => { promise.then(r => { resolve(r); }).catch(r => { reject(r); }); }, errorString, text);
}