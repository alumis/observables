import { Observable, ComputedObservable } from './Observable';

export interface IObservablePromise<T> extends Promise<T> {

    error: Observable<any>;
    errorText: ComputedObservable<string>;
    isErroneous: Observable<boolean>;
    isFinished: Observable<boolean>;
    progress: Observable<number>;
    dispose();
}