import { IObservablePromise } from './IObservablePromise';
import { o, co } from './Observable';

export function createObservablePromise<T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void, progress: (n: number) => void) => void, errorText: (error) => string, autoDispose: boolean) {

    var resolve: (value?: T | PromiseLike<T>) => void;
    var reject: (reason?: any) => void;

    var promise = <IObservablePromise<T>>new Promise((a, b) => {

        resolve = a;
        reject = b;
    });

    promise.error = o(null);
    promise.errorText = co(() => errorText(promise.error.value));
    promise.isErroneous = o(false);
    promise.isFinished = o(false);
    promise.progress = o(0);

    promise.dispose = function () {

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