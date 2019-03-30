import { ObservableSubscription, stack } from "./Observable";

export class ObservableSet<T> {

    constructor(public wrappedSet?: Set<T>) {

        this.dispose = this.dispose.bind(this);

        if (!wrappedSet)
            this.wrappedSet = new Set();

        (this._head.next = this._tail).previous = this._head;
    }

    private _head = ObservableSubscription.create();
    private _tail = ObservableSubscription.create();

    get value() {

        if (stack.length) {

            let computedObservable = stack[stack.length - 1];

            if (!computedObservable.observables.has(this))
                computedObservable.observables.set(this, this.subscribeSneakInLine(computedObservable.refresh));
        }

        return this.wrappedSet;
    }

    add(value: T) {

        if (!this.wrappedSet.has(value)) {

            this.wrappedSet.add(value);
            this.notifySubscribers([value], null);

            return true;
        }

        return false;
    }

    addItems(items: T[]) {

        let addedItems: T[] = [];

        for (let i of items) {

            if (!this.wrappedSet.has(i)) {

                this.wrappedSet.add(i);
                addedItems.push(i);
            }
        }

        if (addedItems.length)
            this.notifySubscribers(addedItems, null);
    }

    reconcile(items: Set<T>) {

        let removedItems: T[] = [];

        for (let i of this.wrappedSet)
            if (!items.has(i))
                removedItems.push(i);

        if (removedItems.length) {

            for (let i of removedItems)
                this.wrappedSet.delete(i);

            this.notifySubscribers(null, removedItems);
        }

        let addedItems: T[] = [];

        for (let i of items) {

            if (!this.wrappedSet.has(i)) {

                this.wrappedSet.add(i);
                addedItems.push(i);
            }
        }

        if (addedItems.length)
            this.notifySubscribers(addedItems, null);
    }

    remove(value: T) {

        if (this.wrappedSet.has(value)) {

            this.wrappedSet.delete(value);
            this.notifySubscribers(null, [value]);

            return true;
        }

        return false;
    }

    removeItems(items: T[]) {

        let removedItems: T[] = [];

        for (let i of items) {

            if (this.wrappedSet.has(i)) {
                this.wrappedSet.delete(i);
                removedItems.push(i);
            }
        }

        if (removedItems.length)
            this.notifySubscribers(null, removedItems);
    }

    clear() {

        let removedItems: T[] = [];

        for (let i of this.wrappedSet)
            removedItems.push(i);

        if (removedItems.length) {

            this.wrappedSet.clear();
            this.notifySubscribers(null, removedItems);
        }
    }

    contains(value: T) {

        return this.wrappedSet.has(value);
    }

    // filter(callbackfn: (item: T) => boolean): FilteredObservableSet<T> {

    //     return new FilteredObservableSet(this, callbackfn);
    // }

    subscribe(action: (addedItems: T[], removedItems: T[]) => any) {

        return ObservableSubscription.createFromTail(this._tail, action);
    }

    subscribeSneakInLine(action: (addedItems: T[], removedItems: T[]) => any) {

        return ObservableSubscription.createFromHead(this._head, action);
    }

    protected notifySubscribers(addedItems: T[], removedItems: T[]) {

        for (let node = this._head.next; node != this._tail; node = node.next)
            node.action(addedItems, removedItems);
    }

    // sort(compareFn: (a: T, b: T) => number) {

    //     return new SortedObservableSet<T>(this, compareFn);
    // }

    // map<U>(mapFunction: (x: T) => U, shouldDisposeMappedItems = false) {

    //     return new MappedObservableSet(this, mapFunction, shouldDisposeMappedItems);
    // }

    dispose() {

        delete this.wrappedSet;

        for (let node = this._head.next; node != this._tail; node = node.next)
            node.recycle();

        this._head.recycle();
        delete this._head;

        this._tail.recycle();
        delete this._tail;
    }
}