import { ComputedObservable, co, ObservableSubscription } from "./Observable";
import { ObservableSet } from "./ObservableSet";

export class FilteredObservableSet<T> extends ObservableSet<T> {

    constructor(public sourceSet: ObservableSet<T>, protected callbackFn: (value: T) => boolean) {
        super();
        let original = sourceSet.wrappedSet, filtered = this.wrappedSet;
        for (let i of original) {
            if (this.createObservable(i))
                filtered.add(i);
        }
        this._subscription = sourceSet.subscribe((addedItems, removedItems) => {
            if (addedItems) {
                for (let i of addedItems) {
                    if (this.createObservable(i))
                        this.add(i);
                }
            }
            else if (removedItems) {
                for (let i of removedItems) {
                    this._observables.get(i).dispose();
                    this._observables.delete(i);
                    this.delete(i);
                }
            }
        });
    }

    private _observables: Map<T, ComputedObservable<boolean>> = new Map();
    private _subscription: ObservableSubscription;

    private createObservable(item: T) {
        let o = co(() => this.callbackFn(item));
        this._observables.set(item, o);
        o.subscribe(n => {
            if (n)
                this.add(item);
            else this.delete(item);
        });
        return o.value;
    }

    dispose() {
        super.dispose();
        this._observables.forEach(o => { o.dispose(); });
        delete this._observables;
        this._subscription.unsubscribeAndRecycle();
        delete this._subscription;
    }
}

declare module "./ObservableSet" {
    interface ObservableSet<T> {
        filter(callbackFn: (value: T) => boolean): FilteredObservableSet<T>;
        filterDisposeSourceWhenDisposed(callbackFn: (value: T) => boolean): FilteredObservableSet<T>;
    }
}

ObservableSet.prototype.filter = function (callbackFn: (value) => boolean) {
    return new FilteredObservableSet(this, callbackFn);
};

ObservableSet.prototype.filterDisposeSourceWhenDisposed = function (callbackFn: (value) => boolean) {
    let result = new FilteredObservableSet(this, callbackFn);
    result.dispose = () => { result.dispose(); this.dispose(); };
    return result;
};