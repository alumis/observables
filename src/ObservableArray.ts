import { ObservableSubscription, stack } from "./Observable";

export class ObservableArray<T> {

    constructor(public wrappedArray?: T[]) {

        if (!wrappedArray)
            this.wrappedArray = [];

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

        return this.wrappedArray;
    }

    protected notifySubscribers(addedItems: T[], removedItems: T[], index: number) {

        for (let node = this._head.next; node != this._tail; node = node.next)
            node.action(addedItems, removedItems, index);
    }

    subscribe(action: (addedItems: T[], removedItems: T[], index: number) => any) {

        return ObservableSubscription.createFromTail(this._tail, action);
    }

    subscribeSneakInLine(action: (addedItems: T[], removedItems: T[], index: number) => any) {

        return ObservableSubscription.createFromHead(this._head, action);
    }

    public [Symbol.iterator]() {
        return this.value[Symbol.iterator]();
    }

    remove(item: T) {

        let array = this.wrappedArray;

        for (let fromIndex = 0; ;) {

            fromIndex = array.indexOf(item, fromIndex);

            if (fromIndex === -1)
                break;

            let removedItem = array[fromIndex];

            array.splice(fromIndex, 1);
            this.notifySubscribers(null, [removedItem], fromIndex);
        }
    }

    removeAt(index: number) {

        let array = this.wrappedArray, removedItems = [array[index]];

        array.splice(index, 1);
        this.notifySubscribers(null, removedItems, index);
    }

    removeRange(index: number, count: number) {

        let array = this.wrappedArray, removedItems = array.splice(index, count);

        if (removedItems.length)
            this.notifySubscribers(null, removedItems, index);
    }

    clear() {

        let removedItems = this.wrappedArray;

        if (removedItems.length) {

            this.wrappedArray = [];
            this.notifySubscribers(null, removedItems, 0);
        }
    }

    add(item: T) {

        let array = this.wrappedArray;

        array.push(item);
        this.notifySubscribers([item], null, this.wrappedArray.length - 1);
    }

    addRange(items: T[]) {

        if (items.length) {

            let array = this.wrappedArray, index = array.length;

            array.push.apply(array, items);
            this.notifySubscribers(items, null, index);
        }
    }

    insert(index: number, item: T) {

        let array = this.wrappedArray;

        array.splice(index, 0, item);
        this.notifySubscribers([item], null, index);
    }

    insertRange(index: number, items: T[]) {

        if (items.length) {

            let array = this.wrappedArray;

            array.splice.apply(array, (<any[]>[index, 0]).concat(items));
            this.notifySubscribers(items, null, index);
        }
    }

    reconcile(items: T[]) {

        this.clear();
        this.addRange(items);
    }

    contains(item: T) {

        for (let i of this.wrappedArray)
            if (i === item)
                return true;

        return false;
    }

    dispose() {

        delete this.wrappedArray;

        for (let node = this._head.next; node != this._tail; node = node.next)
            node.recycle();

        this._head.recycle();
        delete this._head;

        this._tail.recycle();
        delete this._tail;
    }
}