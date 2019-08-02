import { ObservableSubscription, stack } from "./Observable";

export class ObservableSet<T> {

    constructor(iterable?: Iterable<T>) {
        this.dispose = this.dispose.bind(this);
        this.wrappedSet = new Set(iterable);
        (this._head.next = this._tail).previous = this._head;
    }

    wrappedSet: Set<T>;

    private _head = ObservableSubscription.create();
    private _tail = ObservableSubscription.create();

    get value() {
        if (stack.length) {
            let co = stack[stack.length - 1];
            if (!co._observables.has(this))
                co._observables.set(this, this.subscribeSneakInLine(co.refresh));
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

    addItems(items: Iterable<T>) {
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

    clear() {
        let removedItems: T[] = [];
        for (let i of this.wrappedSet)
            removedItems.push(i);
        if (removedItems.length) {
            this.wrappedSet.clear();
            this.notifySubscribers(null, removedItems);
        }
    }

    delete(value: T) {
        if (this.wrappedSet.has(value)) {
            this.wrappedSet.delete(value);
            this.notifySubscribers(null, [value]);
            return true;
        }
        return false;
    }

    deleteItems(items: Iterable<T>) {
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

    has(value: T) {
        return this.wrappedSet.has(value);
    }

    [Symbol.iterator]() { return this.value[Symbol.iterator](); }
    entries() { return this.value.entries(); }
    keys() { return this.value.keys(); }
    values() { return this.value.values(); }

    reconcile(items: Iterable<T>) {
        if (!(items instanceof Set))
            items = new Set(items);
        let removedItems: T[] = [];
        for (let i of this.wrappedSet)
            if (!(items as Set<T>).has(i))
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

    subscribe(action: (addedItems: T[], removedItems: T[]) => any) {
        return ObservableSubscription.createAndPrependToTail(this._tail, action);
    }

    subscribeSneakInLine(action: (addedItems: T[], removedItems: T[]) => any) {
        return ObservableSubscription.createAndAppendToHead(this._head, action);
    }

    private notifySubscribers(addedItems: T[], removedItems: T[]) {
        for (let node = this._head.next; node != this._tail; node = node.next)
            node.callback(addedItems, removedItems);
    }

    dispose() {
        delete this.wrappedSet;
        for (let node = this._head.next; node != this._tail;)
            (node = node.next).previous.recycle();
        this._head.recycle();
        delete this._head;
        this._tail.recycle();
        delete this._tail;
    }
}