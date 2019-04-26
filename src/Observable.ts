import { Semaphore } from "@alumis/semaphore";

export let stack = [];

let observables: Observable<any>[] = [];
let observablesLength = 0;

export class Observable<T> {

    constructor() {

        (this._head.next = this._tail).previous = this._head;

        this.dispose = this.dispose.bind(this);
    }

    static create<T>(value?: T) {

        if (observablesLength) {

            var result = <Observable<T>>observables[--observablesLength];

            observables[observablesLength] = null;
        }

        else var result = new Observable<T>();

        result.wrappedValue = value;

        return result;
    }

    wrappedValue: T;

    _head = ObservableSubscription.create();
    _tail = ObservableSubscription.create();

    _prioritizedHead: ObservableSubscription;
    _prioritizedTail: ObservableSubscription;

    get value() {

        if (stack.length) {

            let computedObservable = <ComputedObservable<T>>stack[stack.length - 1];

            if (!computedObservable.observables.has(this))
                computedObservable.observables.set(this, this.subscribeSneakInLine(computedObservable.refresh));
        }

        return this.wrappedValue;
    }

    set value(newValue: T) {

        let oldValue = this.wrappedValue;

        if (newValue !== oldValue) {

            this.wrappedValue = newValue;
            this.notifySubscribers(newValue, oldValue);
        }
    }

    setValueDontNotify(newValue: T, exemptedObservableSubscription: ObservableSubscription) {

        let oldValue = this.wrappedValue;

        if (newValue !== oldValue) {

            this.wrappedValue = newValue;
            this.notifySubscribersExcept(newValue, oldValue, exemptedObservableSubscription);
        }
    }

    private get prioritizedTail() {

        let value = this._prioritizedTail;

        if (value)
            return value;

        this._prioritizedHead = ObservableSubscription.create();
        this._prioritizedTail = value = ObservableSubscription.create();

        (this._prioritizedHead.next = this._prioritizedTail).previous = this._prioritizedHead;

        return value;
    }

    notifySubscribers(newValue: T, oldValue: T) {

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node !== this._prioritizedTail;) {

                let currentNode = node;

                node = node.next;
                currentNode.action(newValue, oldValue);
            }
        }

        for (node = this._head.next; node !== this._tail;) {

            let currentNode = node;

            node = node.next;
            currentNode.action(newValue, oldValue);
        }
    }

    notifySubscribersExcept(newValue: T, oldValue: T, exemptedObservableSubscription: ObservableSubscription) {

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node !== this._prioritizedTail;) {

                let currentNode = node;

                node = node.next;

                if (currentNode !== exemptedObservableSubscription)
                    currentNode.action(newValue, oldValue);
            }
        }

        for (node = this._head.next; node !== this._tail;) {

            let currentNode = node;

            node = node.next;

            if (currentNode !== exemptedObservableSubscription)
                currentNode.action(newValue, oldValue);
        }
    }

    invalidate() {

        let value = this.wrappedValue;

        this.notifySubscribers(value, value);
    }

    subscribe(action: (newValue: T, oldValue: T, ) => any) {

        return ObservableSubscription.createFromTail(this._tail, action);
    }

    subscribeInvoke(action: (newValue: T, oldValue: T, ) => any) {

        action(this.wrappedValue, void 0);

        let subscription = ObservableSubscription.createFromTail(this._tail, action);

        return subscription;
    }

    prioritizedSubscribe(action: (newValue: T, oldValue: T, ) => any) {

        return ObservableSubscription.createFromTail(this.prioritizedTail, action);
    }

    prioritizedSubscribeInvoke(action: (newValue: T, oldValue: T, ) => any) {

        action(this.wrappedValue, this.wrappedValue);

        let subscription = ObservableSubscription.createFromTail(this.prioritizedTail, action);

        return subscription;
    }

    subscribeSneakInLine(action: (newValue: T, oldValue: T, ) => any) {

        return ObservableSubscription.createFromHead(this._head, action);
    }

    dispose(push = true) {

        delete this.wrappedValue;

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node !== this._prioritizedTail;) {

                let currentNode = node;

                node = node.next;
                currentNode.recycle();
            }

            this._prioritizedHead.recycle();
            delete this._prioritizedHead;

            this._prioritizedTail.recycle();
            delete this._prioritizedTail;
        }

        for (node = this._head.next; node !== this._tail;) {

            let currentNode = node;

            node = node.next;
            currentNode.recycle();
        }

        (this._head.next = this._tail).previous = this._head;

        if (push) {

            if (observables.length === observablesLength)
                observables.push(this);

            else observables[observablesLength] = this;

            ++observablesLength;
        }
    }
}

let observableSubscriptions: ObservableSubscription[] = [];
let observableSubscriptionsLength = 0;

export class ObservableSubscription {

    constructor() {

        this.dispose = this.dispose.bind(this);
    }

    static create() {

        if (observableSubscriptionsLength) {

            let existing = observableSubscriptions[--observableSubscriptionsLength];

            observableSubscriptions[observableSubscriptionsLength] = null;

            return existing;
        }

        else return new ObservableSubscription();
    }

    static createFromTail(tail: ObservableSubscription, action: (...args: any[]) => any) {

        let result = ObservableSubscription.create();

        (result.previous = tail.previous).next = result;
        (result.next = tail).previous = result;

        result.action = action;

        return result;
    }

    static createFromHead(head: ObservableSubscription, action: (...args: any[]) => any) {

        let result = ObservableSubscription.create();

        (result.next = head.next).previous = result;
        (result.previous = head).next = result;

        result.action = action;

        return result;
    }

    previous: ObservableSubscription;
    next: ObservableSubscription;

    action: ((...args: any[]) => any);

    recycle() {

        delete this.previous;
        delete this.next;

        delete this.action;

        if (observableSubscriptions.length === observableSubscriptionsLength)
            observableSubscriptions.push(this);

        else observableSubscriptions[observableSubscriptionsLength] = this;

        ++observableSubscriptionsLength;
    }

    dispose() {

        (this.previous.next = this.next).previous = this.previous;
        this.recycle();
    }
}

let observablesWithError: ObservableWithError<any>[] = [];
let observablesWithErrorLength = 0;

export class ObservableWithError<T> extends Observable<T> {

    error = Observable.create<any>();

    dispose() {

        delete this.wrappedValue;
        delete this.error.wrappedValue;

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node !== this._prioritizedTail;) {

                let currentNode = node;

                node = node.next;
                currentNode.recycle();
            }

            this._prioritizedHead.recycle();
            delete this._prioritizedHead;;

            this._prioritizedTail.recycle();
            delete this._prioritizedTail;;
        }

        for (node = this._head.next; node !== this._tail;) {

            let currentNode = node;

            node = node.next;
            currentNode.recycle();
        }

        (this._head.next = this._tail).previous = this._head;

        if (observablesWithError.length === observablesWithErrorLength)
            observablesWithError.push(this);

        else observablesWithError[observablesWithErrorLength] = this;

        ++observablesWithErrorLength;
    }
}

let computedObservables: ComputedObservable<any>[] = [];
let computedObservablesLength = 0;

export class ComputedObservable<T> extends ObservableWithError<T> {

    constructor() {

        super();

        this.refresh = this.refresh.bind(this);
    }

    static createComputed<T>(expression: () => T, preEvaluate = true) {

        if (computedObservablesLength) {

            var result = <ComputedObservable<T>>computedObservables[--computedObservablesLength];

            computedObservables[computedObservablesLength] = null;
        }

        else var result = new ComputedObservable<T>();

        result.expression = expression;

        if (preEvaluate)
            result.wrappedValue = result.evaluateExpression();

        return result;
    }

    expression: () => T;

    evaluateExpression() {

        stack.push(this);

        var result;

        try {

            result = this.expression();
        }

        catch (e) {

            var oldStack = stack;

            stack = [];

            try {

                this.error.value = e;
            }

            finally {

                (stack = oldStack).pop();
                throw e;
            }
        }

        if (this.error.wrappedValue !== undefined) {

            var oldStack = stack;

            stack = [];

            try {

                this.error.value = undefined;
            }

            catch { }

            stack = oldStack;
        }

        stack.pop();

        return result;
    }

    observables: Map<Observable<T>, ObservableSubscription> = new Map();

    postEvaluate() {

        this.wrappedValue = this.evaluateExpression();
    }

    refresh() {

        let observables = this.observables;

        observables.forEach(s => { s.dispose(); });
        this.observables.clear();

        let oldValue = this.wrappedValue, newValue = this.evaluateExpression();

        if (newValue !== oldValue) {

            this.wrappedValue = newValue;
            this.notifySubscribers(newValue, oldValue);
        }
    }

    get value() {

        if (stack.length) {

            let computedObservable = <ComputedObservable<T>>stack[stack.length - 1];

            if (!computedObservable.observables.has(this))
                computedObservable.observables.set(this, this.subscribeSneakInLine(computedObservable.refresh));
        }

        return this.wrappedValue;
    }

    set value(_: T) {

        throw new Error("Cannot set the value of a ComputedObservable");
    }

    dispose() {

        this.observables.forEach(s => { s.dispose(); });

        delete this.expression;
        delete this.wrappedValue;

        this.observables.clear();

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node !== this._prioritizedTail;) {

                let currentNode = node;

                node = node.next;
                currentNode.recycle();
            }

            this._prioritizedHead.recycle();
            delete this._prioritizedHead;

            this._prioritizedTail.recycle();
            delete this._prioritizedTail;
        }

        for (node = this._head.next; node !== this._tail;) {

            let currentNode = node;

            node = node.next;
            currentNode.recycle();
        }

        (this._head.next = this._tail).previous = this._head;

        if (computedObservables.length === computedObservablesLength)
            computedObservables.push(this);

        else computedObservables[computedObservablesLength] = this;

        ++computedObservablesLength;

        this.error.dispose(false);
    }
}

export function whenAsync(expression: () => boolean) {

    let value;

    try {

        value = expression();
    }

    catch (e) {

        return Promise.reject(value);
    }

    if (value)
        return Promise.resolve(value);

    return new Promise((resolve, reject) => {

        let computedObservable = ComputedObservable.createComputed(expression, false);

        computedObservable.wrappedValue = value;

        computedObservable.subscribe(n => {

            if (n) {

                computedObservable.dispose();
                resolve(n);
            }
        });

        computedObservable.error.subscribe(e => {

            computedObservable.dispose();
            reject(e);
        });
    });
}

export function alwaysWhen(expression: () => boolean, resolve: () => any, reject: (e) => any) {

    let result = ComputedObservable.createComputed(expression);

    result.subscribeInvoke(n => {

        if (n)
            resolve();
    });

    result.error.subscribeInvoke(e => {

        if (e !== undefined)
            reject(e);
    });

    return result;
}

export interface ObservableCollection<T> {

    subscribe(action: (addedItems: T[], removedItems: T[]) => any): ObservableSubscription;
    dispose();
}

export interface OrderedObservableCollection<T> extends ObservableCollection<T> {

    subscribe(action: (addedItems: T[], removedItems: T[], index: number, move: boolean) => any): ObservableSubscription;
    wrappedCollection: T[];
}

export interface DerivedObservableCollection<T, U> extends ObservableCollection<U> {

    sourceCollection: ObservableCollection<T>;
    disposeSourceCollection: boolean;
}

export class ObservableArray<T> implements OrderedObservableCollection<T> {

    constructor(wrappedCollection?: T[]) {

        this.dispose = this.dispose.bind(this);

        if (wrappedCollection)
            this.wrappedCollection = wrappedCollection;

        else this.wrappedCollection = [];

        (this._head.next = this._tail).previous = this._head;
    }

    wrappedCollection: T[];

    private _head = ObservableSubscription.create();
    private _tail = ObservableSubscription.create();

    get value() {

        if (stack.length) {

            let computedObservable = stack[stack.length - 1];

            if (!computedObservable.observables.has(this))
                computedObservable.observables.set(this, this.subscribeSneakInLine(computedObservable.refresh));
        }

        return this.wrappedCollection;
    }

    protected notifySubscribers(addedItems: T[], removedItems: T[], index: number, move?: boolean) {

        for (let node = this._head.next; node != this._tail; node = node.next)
            node.action(addedItems, removedItems, index, move);
    }

    subscribe(action: (addedItems: T[], removedItems: T[], index: number, move: boolean) => any) {

        return ObservableSubscription.createFromTail(this._tail, action);
    }

    subscribeSneakInLine(action: (addedItems: T[], removedItems: T[], index: number, move: boolean) => any) {

        return ObservableSubscription.createFromHead(this._head, action);
    }

    public [Symbol.iterator]() {
        return this.value[Symbol.iterator]();
    }

    remove(item: T) {

        let array = this.wrappedCollection;

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

        let array = this.wrappedCollection, removedItems = [array[index]];

        array.splice(index, 1);
        this.notifySubscribers(null, removedItems, index);
    }

    removeRange(index: number, count: number) {

        let array = this.wrappedCollection, removedItems = array.splice(index, count);

        if (removedItems.length)
            this.notifySubscribers(null, removedItems, index);
    }

    clear() {

        let removedItems = this.wrappedCollection;

        if (removedItems.length) {

            this.wrappedCollection = [];
            this.notifySubscribers(null, removedItems, 0);
        }
    }

    add(item: T) {

        let array = this.wrappedCollection;

        array.push(item);
        this.notifySubscribers([item], null, this.wrappedCollection.length - 1);
    }

    addRange(items: T[]) {

        if (items.length) {

            let array = this.wrappedCollection, index = array.length;

            array.push.apply(array, items);
            this.notifySubscribers(items, null, index);
        }
    }

    insert(index: number, item: T) {

        let array = this.wrappedCollection;

        array.splice(index, 0, item);
        this.notifySubscribers([item], null, index);
    }

    insertRange(index: number, items: T[]) {

        if (items.length) {

            let array = this.wrappedCollection;

            array.splice.apply(array, (<any[]>[index, 0]).concat(items));
            this.notifySubscribers(items, null, index);
        }
    }

    reconcile(items: T[]) {

        // TODO
        this.clear();
        this.addRange(items);
    }

    contains(item: T) {

        for (let i of this.wrappedCollection)
            if (i === item)
                return true;

        return false;
    }

    map<U>(callbackfn: (x: T) => U) {

        return new MappedObservableArray(this, callbackfn, false, true);
    }

    dispose() {

        delete this.wrappedCollection;

        for (let node = this._head.next; node != this._tail;) {

            let currentNode = node;

            node = node.next;
            currentNode.recycle();
        }

        this._head.recycle();
        delete this._head;

        this._tail.recycle();
        delete this._tail;
    }
}

export class MappedObservableArray<T, U> extends ObservableArray<U> implements DerivedObservableCollection<T, U> {

    constructor(public sourceCollection: OrderedObservableCollection<T>, protected callbackfn: (x: T) => U, public disposeSourceCollection: boolean, protected disposeChildren: boolean) {

        super(sourceCollection.wrappedCollection.map(callbackfn));

        let moveMap = new Map<T, U[]>();

        this._sourceCollectionSubscription = sourceCollection.subscribe((addedItems: T[], removedItems: T[], index: number, move: boolean) => {

            if (move) {

                if (addedItems) {

                    let mappedAddedItems = addedItems.map(t => {

                        let uFifo = moveMap.get(t);

                        if (uFifo.length === 1) {

                            let result = uFifo[0];

                            moveMap.delete(t);

                            return result;
                        }

                        return uFifo.shift();
                    });

                    this.wrappedCollection.splice.apply(this.wrappedCollection, (<any[]>[index, 0]).concat(mappedAddedItems));
                    this.notifySubscribers(mappedAddedItems, null, index, true);
                }

                else { // Removed items

                    let mappedRemovedItems = this.wrappedCollection.splice(index, removedItems.length);

                    for (let i = 0; i < removedItems.length; ++i) {

                        let t = removedItems[i];
                        let u = mappedRemovedItems[i];
                        let existingUFifo = moveMap.get(t);

                        if (existingUFifo)
                            existingUFifo.push(u);

                        else moveMap.set(t, [u]);
                    }

                    this.notifySubscribers(null, mappedRemovedItems, index, true);
                }
            }

            else {

                if (addedItems) {

                    let mappedAddedItems = addedItems.map(t => this.callbackfn(t));

                    this.wrappedCollection.splice.apply(this.wrappedCollection, (<any[]>[index, 0]).concat(mappedAddedItems));
                    this.notifySubscribers(mappedAddedItems, null, index, false);
                }

                else { // Removed items

                    let mappedRemovedItems = this.wrappedCollection.splice(index, removedItems.length);

                    if (this.disposeChildren) {

                        for (let u of mappedRemovedItems) {
                            if ((<any>u).dispose)
                                (<any>u).dispose();
                        }
                    }

                    this.notifySubscribers(null, mappedRemovedItems, index, false);
                }
            }
        });
    }

    private _sourceCollectionSubscription: ObservableSubscription;

    map<V>(callbackfn: (x: U) => V) {

        return new MappedObservableArray(this, callbackfn, true, true);
    }

    dispose() {

        if (this.disposeChildren) {

            for (let u of this.wrappedCollection) {

                if ((<any>u).dispose)
                    (<any>u).dispose();
            }
        }

        super.dispose();

        if (this.disposeSourceCollection) {

            this.sourceCollection.dispose();
            delete this.sourceCollection;
        }

        else this._sourceCollectionSubscription.dispose();

        delete this._sourceCollectionSubscription;
    }
}

export class ObservableSet<T> implements ObservableCollection<T> {

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

    filter(callbackfn: (item: T) => boolean): FilteredObservableSet<T> {

        return new FilteredObservableSet(this, callbackfn, false);
    }

    sort(comparefn: (a: T, b: T) => number) {

        return new SortedObservableSet<T>(this, comparefn, false);
    }

    map<U>(callbackfn: (x: T) => U) {

        return new MappedObservableSet(this, callbackfn, false, true);
    }

    dispose() {

        delete this.wrappedSet;

        for (let node = this._head.next; node != this._tail;) {

            let currentNode = node;

            node = node.next;
            currentNode.recycle();
        }

        this._head.recycle();
        delete this._head;

        this._tail.recycle();
        delete this._tail;
    }
}

export class MappedObservableSet<T, U> extends ObservableSet<U> implements DerivedObservableCollection<T, U> {

    constructor(public sourceCollection: ObservableSet<T>, protected callbackfn: (x: T) => U, public disposeSourceCollection: boolean, protected disposeChildren: boolean) {

        super(undefined);

        for (let t of this.sourceCollection.wrappedSet) {

            let u = this.callbackfn(t);

            this._map.set(t, u);
            this.wrappedSet.add(u);
        }

        this._sourceCollectionSubscription = sourceCollection.subscribe((addedItems, removedItems) => {

            let uItems: U[] = [];

            if (addedItems) {

                for (let t of addedItems) {

                    let u = this.callbackfn(t);

                    this._map.set(t, u);
                    uItems.push(u);
                }

                this.addItems(uItems);
            }

            else if (removedItems) {

                for (let t of removedItems) {

                    this._map.delete(t);
                    uItems.push(this._map.get(t));
                }

                this.removeItems(uItems);

                if (disposeChildren) {

                    for (let u of uItems) {
                        if ((<any>u).dispose)
                            (<any>u).dispose();
                    }
                }
            }
        });
    }

    private _map = new Map<T, U>();
    private _sourceCollectionSubscription: ObservableSubscription;

    filter(callbackfn: (item: U) => boolean): FilteredObservableSet<U> {

        return new FilteredObservableSet(this, callbackfn, true);
    }

    sort(comparefn: (a: U, b: U) => number) {

        return new SortedObservableSet<U>(this, comparefn, true);
    }

    map<V>(callbackfn: (x: U) => V) {

        return new MappedObservableSet(this, callbackfn, true, true);
    }

    dispose() {

        if (this.disposeChildren) {

            for (let u of this.wrappedSet) {

                if ((<any>u).dispose)
                    (<any>u).dispose();
            }
        }

        super.dispose();

        delete this._map;

        if (this.disposeSourceCollection) {

            this.sourceCollection.dispose();
            delete this.sourceCollection;
        }

        else this._sourceCollectionSubscription.dispose();

        delete this._sourceCollectionSubscription;
    }
}

export class SortedObservableSet<T> extends ObservableArray<T> implements DerivedObservableCollection<T, T> {

    constructor(public sourceCollection: ObservableSet<T>, protected comparefn: (a: T, b: T) => number, public disposeSourceCollection: boolean) {

        super(sortSet(sourceCollection.wrappedSet, comparefn));

        this.reflow = this.reflow.bind(this);

        for (let i = 0; i < this.wrappedCollection.length; ++i)
            this.createComparison(this.wrappedCollection[i], i);

        this._sourceCollectionSubscription = sourceCollection.subscribe(async (addedItems, removedItems) => {

            await this._semaphore.waitOneAsync();

            try {

                let wrappedCollection = this.wrappedCollection;

                if (addedItems) {

                    for (let item of addedItems) {

                        let sortOrder = binarySearch(wrappedCollection, item, this.comparefn); // Binary search

                        sortOrder = ~sortOrder;
                        wrappedCollection.splice(sortOrder, 0, item);

                        for (let i = sortOrder + 1; i < wrappedCollection.length; ++i)
                            ++this._comparisons.get(wrappedCollection[i])["__sortOrder"];

                        this.createComparison(item, sortOrder);

                        if (sortOrder + 1 < wrappedCollection.length)
                            this._comparisons.get(wrappedCollection[sortOrder + 1]).refresh();

                        if (0 <= sortOrder - 1)
                            this._comparisons.get(wrappedCollection[sortOrder - 1]).refresh();

                        this.notifySubscribers([item], null, sortOrder);
                    }
                }

                else if (removedItems) {

                    for (let item of removedItems) {

                        let comparison = this._comparisons.get(item);
                        let sortOrder: number = comparison["__sortOrder"];

                        comparison.dispose();
                        this._comparisons.delete(item);
                        wrappedCollection.splice(sortOrder, 1);

                        for (let i = sortOrder; i < wrappedCollection.length; ++i)
                            --this._comparisons.get(wrappedCollection[i])["__sortOrder"];

                        if (sortOrder < wrappedCollection.length)
                            this._comparisons.get(wrappedCollection[sortOrder]).refresh();

                        if (0 <= sortOrder - 1)
                            this._comparisons.get(wrappedCollection[sortOrder - 1]).refresh();

                        this.notifySubscribers(null, [item], sortOrder);
                    }
                }
            }

            finally {

                this._semaphore.release();
            }
        });
    }

    private _comparisons: Map<T, ComputedObservable<string>> = new Map();
    private _sourceCollectionSubscription: ObservableSubscription;
    private _semaphore = new Semaphore();

    private createComparison(item: T, sortOrder: number) {

        let comparison = ComputedObservable.createComputed<string>(() => {

            let sortOrder = comparison["__sortOrder"];

            if (0 < sortOrder) {

                if (sortOrder + 1 < this.wrappedCollection.length)
                    return SortedObservableSet.normalizeCompare(this.comparefn(item, this.wrappedCollection[sortOrder - 1])) + " " + SortedObservableSet.normalizeCompare(this.comparefn(this.wrappedCollection[sortOrder + 1], item));

                return SortedObservableSet.normalizeCompare(this.comparefn(item, this.wrappedCollection[sortOrder - 1])) + " 1";
            }

            else if (1 < this.wrappedCollection.length)
                return "1 " + SortedObservableSet.normalizeCompare(this.comparefn(this.wrappedCollection[1], item));

            return "1 1";

        }, false);

        comparison["__sortOrder"] = sortOrder;

        comparison.postEvaluate();

        this.subscribeToComparison(item, comparison);

        this._comparisons.set(item, comparison);
    }

    private static normalizeCompare(n: number) {

        if (n < 0)
            return -1;

        if (n === 0)
            return 0;

        if (0 < n)
            return 1;

        throw new Error("n is not a number");
    }

    private _reflowHandle: number;

    private reflow() {

        if (this._reflowHandle)
            return;

        let semaphorePromise = this._semaphore.waitOneAsync();

        this._reflowHandle = setTimeout(async () => {

            await semaphorePromise;

            try {

                let wrappedCollection = this.wrappedCollection;
                let wrappedCollectionToBe = wrappedCollection.map(i => i).sort(this.comparefn);
                let wrappedCollectionToBeSortOrders = new Map<T, number>(); for (let i = 0; i < wrappedCollectionToBe.length; ++i) wrappedCollectionToBeSortOrders.set(wrappedCollectionToBe[i], i);

                let sortOrders: { item: T; oldSortOrder: number; newSortOrder: number; }[] = [];

                let processedItems = new Set<T>();

                for (let i = 0, sortOrder = 0; i < wrappedCollectionToBe.length && sortOrder < wrappedCollection.length;) {

                    let itemThatEndedUpHere = wrappedCollectionToBe[i];

                    if (processedItems.has(itemThatEndedUpHere)) {

                        ++i;
                        continue;
                    }

                    let itemThatWasHere = wrappedCollection[sortOrder];

                    if (itemThatEndedUpHere !== itemThatWasHere) {

                        let itemThatEndedUpHereOldSortOrder = <number>this._comparisons.get(itemThatEndedUpHere)["__sortOrder"];
                        let itemThatWasHereNewSortOrder = wrappedCollectionToBeSortOrders.get(itemThatWasHere);

                        if (Math.abs(itemThatEndedUpHereOldSortOrder - sortOrder) < Math.abs(itemThatWasHereNewSortOrder - sortOrder)) {

                            sortOrders.push({ item: itemThatWasHere, oldSortOrder: <number>this._comparisons.get(itemThatWasHere)["__sortOrder"], newSortOrder: itemThatWasHereNewSortOrder });
                            processedItems.add(itemThatWasHere);
                            ++sortOrder;
                            continue;
                        }

                        else sortOrders.push({ item: itemThatEndedUpHere, oldSortOrder: itemThatEndedUpHereOldSortOrder, newSortOrder: i });
                    }

                    else ++sortOrder;

                    ++i;
                }

                let comparisonsToRefresh = new Set<ComputedObservable<string>>();
                let lengthOneArray = [null];

                for (let i of sortOrders.sort((a, b) => b.oldSortOrder - a.oldSortOrder)) {

                    let comparison = this._comparisons.get(i.item);
                    let sortOrder = i.oldSortOrder;

                    comparison.dispose();
                    this._comparisons.delete(i.item);
                    wrappedCollection.splice(sortOrder, 1);

                    if (sortOrder < wrappedCollection.length)
                        comparisonsToRefresh.add(this._comparisons.get(wrappedCollection[sortOrder]));

                    if (0 <= sortOrder - 1)
                        comparisonsToRefresh.add(this._comparisons.get(wrappedCollection[sortOrder - 1]));

                    lengthOneArray[0] = i.item;
                    this.notifySubscribers(null, lengthOneArray, sortOrder, true);
                }

                for (let i of sortOrders.sort((a, b) => a.newSortOrder - b.newSortOrder)) {

                    let sortOrder = i.newSortOrder;

                    wrappedCollection.splice(sortOrder, 0, i.item);
                    this.createComparison(i.item, sortOrder);

                    if (sortOrder + 1 < wrappedCollection.length)
                        comparisonsToRefresh.add(this._comparisons.get(wrappedCollection[sortOrder + 1]));

                    if (0 <= sortOrder - 1)
                        comparisonsToRefresh.add(this._comparisons.get(wrappedCollection[sortOrder - 1]));

                    lengthOneArray[0] = i.item;
                    this.notifySubscribers(lengthOneArray, null, sortOrder, true);
                }

                for (let i = 0; i < wrappedCollectionToBe.length; ++i)
                    this._comparisons.get(wrappedCollection[i])["__sortOrder"] = i;

                for (var c of comparisonsToRefresh)
                    c.refresh();

                delete this._reflowHandle;
            }

            finally {

                this._semaphore.release();
            }

        }, 0);
    }

    private subscribeToComparison(_item: T, observable: ComputedObservable<any>) {

        observable.subscribe(this.reflow);
    }

    remove(_item: T) {

        throw new Error("Not supported");
    }

    removeAt(_index: number) {

        throw new Error("Not supported");
    }

    removeRange(_index: number, _count: number) {

        throw new Error("Not supported");
    }

    clear() {

        throw new Error("Not supported");
    }

    add(_item: T) {

        throw new Error("Not supported");
    }

    addRange(_items: T[]) {

        throw new Error("Not supported");
    }

    insert(_index: number, _item: T) {

        throw new Error("Not supported");
    }

    insertRange(_index: number, _items: T[]) {

        throw new Error("Not supported");
    }

    map<U>(callbackfn: (x: T) => U) {

        return new MappedObservableArray(this, callbackfn, true, true);
    }

    dispose() {

        super.dispose();

        this._comparisons.forEach(c => { c.dispose(); });
        delete this._comparisons;

        if (this.disposeSourceCollection) {

            this.sourceCollection.dispose();
            delete this.sourceCollection;
        }

        else this._sourceCollectionSubscription.dispose();

        delete this._sourceCollectionSubscription;
    }
}

function sortSet<T>(set: Set<T>, sortFunction: (a: T, b: T) => number) {

    let result: T[] = [];

    for (let i of set)
        result.push(i);

    return result.sort(sortFunction);
}

function binarySearch<T>(array: T[], item: T, comparefn?: (a: T, b: T) => number) {

    let l = 0, h = array.length - 1, m, comparison;

    comparefn = comparefn || ((a: T, b: T) => a < b ? -1 : (a > b ? 1 : 0));

    while (l <= h) {

        m = (l + h) >>> 1;
        comparison = comparefn(array[m], item);

        if (comparison < 0)
            l = m + 1;

        else if (comparison > 0)
            h = m - 1;

        else return m;
    }

    return ~l;
}

export class FilteredObservableSet<T> extends ObservableSet<T> implements DerivedObservableCollection<T, T> {

    constructor(public sourceCollection: ObservableSet<T>, protected callbackfn: (value: T) => boolean, public disposeSourceCollection: boolean) {

        super(undefined);

        let original = sourceCollection.wrappedSet;
        let filtered = this.wrappedSet;

        for (let i of original) {

            if (this.createObservable(i))
                filtered.add(i);
        }

        this._sourceCollectionSubscription = sourceCollection.subscribe((addedItems, removedItems) => {

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

                    this.remove(i);
                }
            }
        });
    }

    private _observables: Map<T, ComputedObservable<boolean>> = new Map();
    private _sourceCollectionSubscription: ObservableSubscription;

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

    filter(callbackfn: (item: T) => boolean): FilteredObservableSet<T> {

        return new FilteredObservableSet(this, callbackfn, true);
    }

    sort(comparefn: (a: T, b: T) => number) {

        return new SortedObservableSet<T>(this, comparefn, true);
    }

    map<U>(callbackfn: (x: T) => U) {

        return new MappedObservableSet(this, callbackfn, true, true);
    }

    dispose() {

        super.dispose();

        this._observables.forEach(o => { o.dispose(); });
        delete this._observables;

        if (this.disposeSourceCollection) {

            this.sourceCollection.dispose();
            delete this.sourceCollection;
        }

        else this._sourceCollectionSubscription.dispose();

        delete this._sourceCollectionSubscription;
    }
}

export function o<T>(value?: T) {

    return Observable.create<T>(value);
}

export function co<T>(expression: () => T) {

    return ComputedObservable.createComputed(expression);
}