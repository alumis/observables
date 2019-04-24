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

export interface DerivedObservableCollection extends ObservableCollection {

    derivedFrom: ObservableCollection;
    canDisposeDerivedFrom: boolean;
}

export interface ObservableCollection {

    canTakeOwnership: boolean;
    dispose();
}

export class ObservableArray<T> implements ObservableCollection {

    constructor(public wrappedArray?: T[], public canTakeOwnership = false) {

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

    protected notifySubscribers(addedOrRemovedItems: AddedOrRemovedItems<T>[]) {

        for (let node = this._head.next; node != this._tail; node = node.next)
            node.action(addedOrRemovedItems);
    }

    subscribe(action: (addedOrRemovedItems: AddedOrRemovedItems<T>[]) => any) {

        return ObservableSubscription.createFromTail(this._tail, action);
    }

    subscribeSneakInLine(action: (addedOrRemovedItems: AddedOrRemovedItems<T>[]) => any) {

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
            this.notifySubscribers([<AddedOrRemovedItems<T>>{ removedItems: [removedItem], index: fromIndex }]);
        }
    }

    removeAt(index: number) {

        let array = this.wrappedArray, removedItems = [array[index]];

        array.splice(index, 1);
        this.notifySubscribers([<AddedOrRemovedItems<T>>{ removedItems: removedItems, index: index }]);
    }

    removeRange(index: number, count: number) {

        let array = this.wrappedArray, removedItems = array.splice(index, count);

        if (removedItems.length)
            this.notifySubscribers([<AddedOrRemovedItems<T>>{ removedItems: removedItems, index: index }]);
    }

    clear() {

        let removedItems = this.wrappedArray;

        if (removedItems.length) {

            this.wrappedArray = [];
            this.notifySubscribers([<AddedOrRemovedItems<T>>{ removedItems: removedItems, index: 0 }]);
        }
    }

    add(item: T) {

        let array = this.wrappedArray;

        array.push(item);
        this.notifySubscribers([<AddedOrRemovedItems<T>>{ addedItems: [item], index: this.wrappedArray.length - 1 }]);
    }

    addRange(items: T[]) {

        if (items.length) {

            let array = this.wrappedArray, index = array.length;

            array.push.apply(array, items);
            this.notifySubscribers([<AddedOrRemovedItems<T>>{ addedItems: items, index: index }]);
        }
    }

    insert(index: number, item: T) {

        let array = this.wrappedArray;

        array.splice(index, 0, item);
        this.notifySubscribers([<AddedOrRemovedItems<T>>{ addedItems: [item], index: index }]);
    }

    insertRange(index: number, items: T[]) {

        if (items.length) {

            let array = this.wrappedArray;

            array.splice.apply(array, (<any[]>[index, 0]).concat(items));
            this.notifySubscribers([<AddedOrRemovedItems<T>>{ addedItems: items, index: index }]);
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

    map<U>(callbackfn: (x: T) => U) {

        if (this.canTakeOwnership) {

            this.canTakeOwnership = false;

            return new MappedObservableArray(this, true, callbackfn, true, true);
        }

        return new MappedObservableArray(this, false, callbackfn, true, true);
    }

    dispose() {

        delete this.wrappedArray;

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

export class MappedObservableArray<T, U> extends ObservableArray<U> implements DerivedObservableCollection {

    constructor(public derivedFrom: ObservableArray<T>, public canDisposeDerivedFrom: boolean, protected callbackfn: (x: T) => U, canTakeOwnership: boolean, protected shouldDisposeMappedItemsWhenDisposing: boolean) {

        super(derivedFrom.wrappedArray.map(callbackfn), canTakeOwnership);

        this._derivedFromSubscription = derivedFrom.subscribe((addedOrRemovedItems: AddedOrRemovedItems<T>[]) => {

            let wrappedArray = this.wrappedArray;
            let moveMap: Map<T, U[]>;

            this.notifySubscribers(addedOrRemovedItems.map(i => {

                if (i.addedItems) {

                    if (i.move) {

                        let addedItems = i.addedItems.map(t => {

                            let uItems = moveMap.get(t);
                            let u = uItems.shift();

                            if (!uItems.length)
                                moveMap.delete(t);

                            return u;

                        });

                        wrappedArray.splice.apply(wrappedArray, (<any[]>[i.index, 0]).concat(addedItems));

                        return <AddedOrRemovedItems<U>>{ addedItems: addedItems, index: i.index, move: true };
                    }

                    else {

                        let addedItems = i.addedItems.map(t => this.callbackfn(t));

                        wrappedArray.splice.apply(wrappedArray, (<any[]>[i.index, 0]).concat(addedItems));

                        return <AddedOrRemovedItems<U>>{ addedItems: addedItems, index: i.index };
                    }
                }

                else if (i.removedItems) {

                    if (i.move) {

                        if (!moveMap)
                            moveMap = new Map();

                        let uItems = wrappedArray.splice(i.index, i.removedItems.length);

                        for (let j = 0; j < i.removedItems.length; ++j) {

                            let t = i.removedItems[j];
                            let u = uItems[j];
                            let existingUItems = moveMap.get(t);

                            if (!existingUItems)
                                moveMap.set(t, [u]);

                            else existingUItems.push(u);
                        }

                        return <AddedOrRemovedItems<U>>{ removedItems: uItems, index: i.index, move: true };
                    }

                    else {

                        let uItems = wrappedArray.splice(i.index, i.removedItems.length);

                        if (shouldDisposeMappedItemsWhenDisposing) {

                            for (let u of uItems) {
                                if ((<any>u).dispose)
                                    (<any>u).dispose();
                            }
                        }

                        return <AddedOrRemovedItems<U>>{ removedItems: uItems, index: i.index };
                    }
                }
            }));
        });
    }

    private _derivedFromSubscription: ObservableSubscription;

    dispose() {

        if (this.shouldDisposeMappedItemsWhenDisposing) {

            for (let u of this.wrappedArray) {

                if ((<any>u).dispose)
                    (<any>u).dispose();
            }
        }

        super.dispose();

        this._derivedFromSubscription.dispose();
        delete this._derivedFromSubscription;

        if (this.canDisposeDerivedFrom)
            this.derivedFrom.dispose();
    }
}

export class ObservableSet<T> implements ObservableCollection {

    constructor(public wrappedSet?: Set<T>, public canTakeOwnership = false) {

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

    sort(compareFn: (a: T, b: T) => number) {

        if (this.canTakeOwnership) {

            this.canTakeOwnership = false;

            return new SortedObservableSet<T>(this, true, compareFn, true);
        }

        return new SortedObservableSet<T>(this, false, compareFn, true);
    }

    map<U>(callbackfn: (x: T) => U) {

        if (this.canTakeOwnership) {

            this.canTakeOwnership = false;

            return new MappedObservableSet(this, true, callbackfn, true, true);
        }

        return new MappedObservableSet(this, false, callbackfn, true, true);
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

export class MappedObservableSet<T, U> extends ObservableSet<U> implements DerivedObservableCollection {

    constructor(public derivedFrom: ObservableSet<T>, public canDisposeDerivedFrom: boolean, protected callbackfn: (x: T) => U, canTakeOwnership: boolean, protected shouldDisposeMappedItemsWhenDisposing: boolean) {

        super(undefined, canTakeOwnership);

        for (let t of this.derivedFrom.wrappedSet) {

            let u = this.callbackfn(t);

            this._map.set(t, u);
            this.wrappedSet.add(u);
        }

        this._derivedFromSubscription = derivedFrom.subscribe((addedItems, removedItems) => {

            let uItems: U[] = [];

            if (addedItems) {

                for (let t of addedItems) {

                    let u = this.callbackfn(t);

                    this._map.set(t, u);
                    uItems.push(u);
                }

                this.addItems(uItems);
                uItems = [];
            }

            else if (removedItems) {

                for (let t of removedItems) {

                    this._map.delete(t);
                    uItems.push(this._map.get(t));
                }

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

    private _map = new Map<T, U>();
    private _derivedFromSubscription: ObservableSubscription;

    dispose() {

        if (this.shouldDisposeMappedItemsWhenDisposing) {

            for (let u of this.wrappedSet) {

                if ((<any>u).dispose)
                    (<any>u).dispose();
            }
        }

        super.dispose();

        this._derivedFromSubscription.dispose();
        delete this._derivedFromSubscription;

        delete this._map;

        if (this.canDisposeDerivedFrom)
            this.derivedFrom.dispose();
    }
}

export class SortedObservableSet<T> extends ObservableArray<T> implements DerivedObservableCollection {

    constructor(public derivedFrom: ObservableSet<T>, public canDisposeDerivedFrom: boolean, protected comparefn: (a: T, b: T) => number, canTakeOwnership: boolean) {

        super(sortSet(derivedFrom.wrappedSet, comparefn), canTakeOwnership);

        for (let i = 0; i < this.wrappedArray.length; ++i)
            this.createComparison(this.wrappedArray[i], i);

        this._derivedFromSubscription = derivedFrom.subscribe(async (addedItems, removedItems) => {

            await this._semaphore.waitOneAsync();

            try {

                let wrappedArray = this.wrappedArray;

                if (addedItems) {

                    for (let item of addedItems) {

                        let sortOrder = binarySearch(wrappedArray, item, this.comparefn); // Binary search

                        sortOrder = ~sortOrder;
                        wrappedArray.splice(sortOrder, 0, item);

                        for (let i = sortOrder + 1; i < wrappedArray.length; ++i)
                            ++this._comparisons.get(wrappedArray[i])["__sortOrder"];

                        this.createComparison(item, sortOrder);

                        if (sortOrder + 1 < wrappedArray.length)
                            this._comparisons.get(wrappedArray[sortOrder + 1]).refresh();

                        if (0 <= sortOrder - 1)
                            this._comparisons.get(wrappedArray[sortOrder - 1]).refresh();

                        this.notifySubscribers([<AddedOrRemovedItems<T>>{ addedItems: [item], index: sortOrder }]);
                    }
                }

                else if (removedItems) {

                    for (let item of removedItems) {

                        let comparison = this._comparisons.get(item);
                        let sortOrder: number = comparison["__sortOrder"];

                        comparison.dispose();
                        this._comparisons.delete(item);
                        wrappedArray.splice(sortOrder, 1);

                        for (let i = sortOrder; i < wrappedArray.length; ++i)
                            --this._comparisons.get(wrappedArray[i])["__sortOrder"];

                        if (sortOrder < wrappedArray.length)
                            this._comparisons.get(wrappedArray[sortOrder]).refresh();

                        if (0 <= sortOrder - 1)
                            this._comparisons.get(wrappedArray[sortOrder - 1]).refresh();

                        this.notifySubscribers([<AddedOrRemovedItems<T>>{ removedItems: [item], index: sortOrder }]);
                    }
                }
            }

            finally {

                this._semaphore.release();
            }
        });
    }

    private _comparisons: Map<T, ComputedObservable<string>> = new Map();
    private _derivedFromSubscription: ObservableSubscription;
    private _semaphore = new Semaphore();

    private createComparison(item: T, sortOrder: number) {

        let comparison = ComputedObservable.createComputed<string>(() => {

            let sortOrder = comparison["__sortOrder"];

            if (0 < sortOrder) {

                if (sortOrder + 1 < this.wrappedArray.length)
                    return SortedObservableSet.normalizeCompareFn(this.comparefn(item, this.wrappedArray[sortOrder - 1])) + " " + SortedObservableSet.normalizeCompareFn(this.comparefn(this.wrappedArray[sortOrder + 1], item));

                return SortedObservableSet.normalizeCompareFn(this.comparefn(item, this.wrappedArray[sortOrder - 1])) + " 1";
            }

            else if (1 < this.wrappedArray.length)
                return "1 " + SortedObservableSet.normalizeCompareFn(this.comparefn(this.wrappedArray[1], item));

            return "1 1";

        }, false);

        comparison["__sortOrder"] = sortOrder;

        comparison.postEvaluate();

        this.subscribeToComparison(item, comparison);

        this._comparisons.set(item, comparison);
    }

    static normalizeCompareFn(n: number) {

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

                let wrappedArray = this.wrappedArray;
                let wrappedArrayToBe = sortSet(this.derivedFrom.wrappedSet, this.comparefn);

                let newSortOrdersMap = new Map<T, number>();

                for (let i = 0; i < wrappedArrayToBe.length; ++i)
                    newSortOrdersMap.set(wrappedArrayToBe[i], i);

                let itemsToRemoveAndAdd: { item: T; oldSortOrder: number; newSortOrder: number; }[] = [];

                let processedItems = new Set<T>();

                for (let i = 0, sortOrder = 0; i < wrappedArrayToBe.length && sortOrder < wrappedArray.length;) {

                    let itemThatEndedUpHere = wrappedArrayToBe[i];

                    if (processedItems.has(itemThatEndedUpHere)) {

                        ++i;
                        continue;
                    }

                    let itemThatWasHere = wrappedArray[sortOrder];

                    if (itemThatEndedUpHere !== itemThatWasHere) {

                        let itemThatEndedUpHereOldSortOrder = <number>this._comparisons.get(itemThatEndedUpHere)["__sortOrder"];
                        let itemThatWasHereNewSortOrder = newSortOrdersMap.get(itemThatWasHere);

                        if (Math.abs(itemThatEndedUpHereOldSortOrder - sortOrder) < Math.abs(itemThatWasHereNewSortOrder - sortOrder)) {

                            itemsToRemoveAndAdd.push({ item: itemThatWasHere, oldSortOrder: <number>this._comparisons.get(itemThatWasHere)["__sortOrder"], newSortOrder: itemThatWasHereNewSortOrder });
                            processedItems.add(itemThatWasHere);
                            ++sortOrder;
                            continue;
                        }

                        else itemsToRemoveAndAdd.push({ item: itemThatEndedUpHere, oldSortOrder: itemThatEndedUpHereOldSortOrder, newSortOrder: i });
                    }

                    else ++sortOrder;

                    ++i;
                }

                let addedOrRemovedItems: AddedOrRemovedItems<T>[] = [];
                let comparisonsToRefresh = new Set<ComputedObservable<string>>();

                for (let i of itemsToRemoveAndAdd.sort((a, b) => b.oldSortOrder - a.oldSortOrder)) {

                    let comparison = this._comparisons.get(i.item);
                    let sortOrder = i.oldSortOrder;

                    comparison.dispose();
                    this._comparisons.delete(i.item);
                    wrappedArray.splice(sortOrder, 1);

                    if (sortOrder < wrappedArray.length)
                        comparisonsToRefresh.add(this._comparisons.get(wrappedArray[sortOrder]));

                    if (0 <= sortOrder - 1)
                        comparisonsToRefresh.add(this._comparisons.get(wrappedArray[sortOrder - 1]));

                    addedOrRemovedItems.push(<AddedOrRemovedItems<T>>{ removedItems: [i.item], index: sortOrder, move: true });
                }

                for (let i of itemsToRemoveAndAdd.sort((a, b) => a.newSortOrder - b.newSortOrder)) {

                    let sortOrder = i.newSortOrder;

                    wrappedArray.splice(sortOrder, 0, i.item);
                    this.createComparison(i.item, sortOrder);

                    if (sortOrder + 1 < wrappedArray.length)
                        comparisonsToRefresh.add(this._comparisons.get(wrappedArray[sortOrder + 1]));

                    if (0 <= sortOrder - 1)
                        comparisonsToRefresh.add(this._comparisons.get(wrappedArray[sortOrder - 1]));

                    addedOrRemovedItems.push(<AddedOrRemovedItems<T>>{ addedItems: [i.item], index: sortOrder, move: true });
                }

                for (let i = 0; i < wrappedArrayToBe.length; ++i)
                    this._comparisons.get(wrappedArray[i])["__sortOrder"] = i;

                for (var c of comparisonsToRefresh)
                    c.refresh();

                this.notifySubscribers(addedOrRemovedItems);

                delete this._reflowHandle;
            }

            finally {

                this._semaphore.release();
            }

        }, 0);
    }

    private subscribeToComparison(item: T, observable: ComputedObservable<any>) {

        observable.subscribe(() => { this.reflow(); });
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

    dispose() {

        super.dispose();

        this._derivedFromSubscription.dispose();
        delete this._derivedFromSubscription;

        this._comparisons.forEach(c => { c.dispose(); });
        delete this._comparisons;

        if (this.canDisposeDerivedFrom)
            this.derivedFrom.dispose();
    }
}

export interface AddedOrRemovedItems<T> {

    addedItems: T[];
    removedItems: T[];

    index: number;

    move: boolean;
}

function sortSet<T>(set: Set<T>, sortFunction: (a: T, b: T) => number) {

    let result: T[] = [];

    for (let i of set)
        result.push(i);

    return result.sort(sortFunction);
}

function binarySearch<T>(array: T[], item: T, compareFn?: (a: T, b: T) => number) {

    let l = 0, h = array.length - 1, m, comparison;

    compareFn = compareFn || ((a: T, b: T) => a < b ? -1 : (a > b ? 1 : 0));

    while (l <= h) {

        m = (l + h) >>> 1;
        comparison = compareFn(array[m], item);

        if (comparison < 0)
            l = m + 1;

        else if (comparison > 0)
            h = m - 1;

        else return m;
    }

    return ~l;
}

export class FilteredObservableSet<T> extends ObservableSet<T> implements DerivedObservableCollection {

    constructor(public derivedFrom: ObservableSet<T>, public canDisposeDerivedFrom: boolean, protected callbackfn: (value: T) => boolean, canTakeOwnership: boolean) {

        super(undefined, canTakeOwnership);

        let original = derivedFrom.wrappedSet;
        let filtered = this.wrappedSet;

        for (let i of original) {

            if (this.createObservable(i))
                filtered.add(i);
        }

        this._derivedFromSubscription = derivedFrom.subscribe((addedItems, removedItems) => {

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
    private _derivedFromSubscription: ObservableSubscription;

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

        super.dispose();

        this._derivedFromSubscription.dispose();
        delete this._derivedFromSubscription;

        this._observables.forEach(o => { o.dispose(); });
        delete this._observables;

        if (this.canDisposeDerivedFrom)
            this.derivedFrom.dispose();
    }
}