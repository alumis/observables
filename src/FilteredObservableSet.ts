import { ObservableSet, ComputedObservable, ObservableSubscription } from "src";

export class FilteredObservableSet<T> extends ObservableSet<T> {

    constructor(public parentSet: ObservableSet<T>, protected callbackfn: (item: T) => boolean) {

        super();

        let originalPeek = parentSet.wrappedSet;
        let filteredPeek = this.wrappedSet;

        for (let i of originalPeek) {

            if (this.createObservable(i))
                filteredPeek.add(i);
        }

        this._setSubscription = parentSet.subscribe((addedItems, removedItems) => {

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
    private _setSubscription: ObservableSubscription;

    private createObservable(item: T) {

        let computedObservable = ComputedObservable.createComputed(() => this.callbackfn(item));

        this._observables.set(item, computedObservable);

        computedObservable.subscribe(n => {

            if (n)
                this.add(item);

            else this.remove(item);
        });

        return computedObservable.value;
    }

    dispose() {

        this._setSubscription.dispose();
        this._observables.forEach(o => { o.dispose(); });
    }
}