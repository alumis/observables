import { IObservablePromise } from './IObservablePromise';
import { o, co } from './Observable';

export function createObservablePromise<T>(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void, progress: (n: number) => void) => void, errorString: (error:any) => string) {

    var resolve: (value?: T | PromiseLike<T>) => void;
    var reject: (reason?: any) => void;

    var promise = <IObservablePromise<T>>new Promise((a, b) => {

        resolve = a;
        reject = b;
    });

    promise.error = o(null);
    promise.errorText = co(() => errorString(promise.error.value));
    promise.isErroneous = o(false);
    promise.isFinished = o(false);
    promise.progress = o(0);

    executor(
        v => { resolve(v); promise.progress.value = 1; promise.isFinished.value = true; },
        r => { reject(r); promise.error.value = r; promise.isErroneous.value = true; },
        n => { promise.progress.value = n;  });

    return promise;
}