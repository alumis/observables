import { IObservablePromise } from "./IObservablePromise";
import { ComputedObservable } from "./Observable";

export interface IObservablePromiseWithText<T> extends IObservablePromise<T> {

    text: ComputedObservable<string>;
}