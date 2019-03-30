import { ObservableSet, ComputedObservable, ObservableSubscription } from "src";

export class FilteredObservableSet<T> extends ObservableSet<T> {

    constructor(public parentSet: ObservableSet<T>, protected filterFunction: (item: T) => boolean) {

        super();

        let original = parentSet.wrappedSet;
        let filtered = this.wrappedSet;

        for (let i of original) {

            if (this.createObservable(i))
                filtered.add(i);
        }

        this._subscription = parentSet.subscribe((addedItems, removedItems) => {

            for (let i of removedItems) {

                this._observables.get(i).dispose();
                this._observables.delete(i);

                this.remove(i);
            }

            for (let i of addedItems) {

                if (this.createObservable(i))
                    this.add(i);
            }
        });
    }

    private _observables: Map<T, ComputedObservable<boolean>> = new Map();
    private _subscription: ObservableSubscription;

    private createObservable(item: T) {

        let computedObservable = ComputedObservable.createComputed(() => this.filterFunction(item));

        this._observables.set(item, computedObservable);

        computedObservable.subscribe(n => {

            if (n)
                this.add(item);

            else this.remove(item);
        });

        return computedObservable.value;
    }

    dispose() {

        super.dispose();

        this._subscription.dispose();
        delete this._subscription;

        this._observables.forEach(o => { o.dispose(); });
        delete this._observables;
    }
}