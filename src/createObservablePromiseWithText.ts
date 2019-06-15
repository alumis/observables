import { IObservablePromiseWithText } from "./IObservablePromiseWithText";
import { o, co } from "./Observable";

export function createObservablePromiseWithText<T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void, progress: (n: number) => void) => void, errorText: (error) => string, text: () => string, autoDispose: boolean) {

    var resolve: (value?: T | PromiseLike<T>) => void;
    var reject: (reason?: any) => void;

    var promise = <IObservablePromiseWithText<T>>new Promise((a, b) => {

        resolve = a;
        reject = b;
    });

    promise.error = o(null);
    promise.errorText = co(() => errorText(promise.error.value));
    promise.isErroneous = o(false);
    promise.isFinished = o(false);
    promise.progress = o(0);
    promise.text = co(text);

    promise.dispose = function () {

        promise.text.dispose();
        promise.progress.dispose();
        promise.isFinished.dispose();
        promise.errorText.dispose();
        promise.error.dispose();
    };

    executor(
        v => { try { promise.progress.value = 1; promise.isFinished.value = true; resolve(v); } finally { if (autoDispose) promise.dispose(); } },
        r => { try { promise.error.value = r; promise.isErroneous.value = true; reject(r); } finally { if (autoDispose) promise.dispose(); } },
        n => { promise.progress.value = n; });

    return promise;
}

export function createObservablePromiseWithTextFromPromise<T>(promise: Promise<T>, errorText: (error:any) => string, text: () => string, autoDispose: boolean) {

    return createObservablePromiseWithText<T>((resolve, reject, progress) => { promise.then(r => { resolve(r); }).catch(r => { reject(r); }); }, errorText, text, autoDispose);
}