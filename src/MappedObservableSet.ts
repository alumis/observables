import { ObservableSet, ObservableSubscription } from "src";

export class MappedObservableSet<T, U> extends ObservableSet<U> {

    constructor(public parentSet: ObservableSet<T>, protected mapFunction: (x: T) => U, protected shouldDisposeMappedItemsWhenDisposing = false) {

        super();

        for (let t of this.parentSet.wrappedSet) {

            let u = this.mapFunction(t);

            this._map.set(t, u);
            this.wrappedSet.add(u);
        }

        this._subscription = parentSet.subscribe((addedItems, removedItems) => {

            let uItems: U[] = [];

            for (let t of addedItems) {
    
                let u = this.mapFunction(t);
    
                this._map.set(t, u);
                uItems.push(u);
            }

            if (uItems.length) {

                this.addItems(uItems);
                uItems = [];
            }
    
            for (let t of removedItems) {

                this._map.delete(t);
                uItems.push(this._map.get(t));
            }

            if (uItems.length) {

                this.removeItems(uItems);

                if (shouldDisposeMappedItemsWhenDisposing) {

                    for (let u of uItems) {
                        if ((<any>u).dispose)
                            (<any>u).dispose();
                    }
                }
            }
        });
    }

    private _subscription: ObservableSubscription;
    private _map = new Map<T, U>();

    dispose() {

        super.dispose();

        if (this.shouldDisposeMappedItemsWhenDisposing) {

            for (let u of this.wrappedSet) {

                if ((<any>u).dispose)
                    (<any>u).dispose();
            }
        }

        this._subscription.dispose();
    }
}