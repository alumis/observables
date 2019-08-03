let observableBin: ModifiableObservable<any>[] = [], observableBinLength = 0;

export var stack = [];

export interface Observable<T> {

    value: T;
    wrappedValue: T;
    subscribe(callback: (newValue: T, oldValue: T) => any): ObservableSubscription;
    subscribeInvoke(callback: (newValue: T, oldValue: T) => any): ObservableSubscription;
    invalidate(): void;
    dispose(): void;
}

export class ModifiableObservable<T> implements Observable<T> {

    constructor() {
        this.dispose = this.dispose.bind(this);
        (this._head.next = this._tail).previous = this._head;
    }

    wrappedValue: T;

    private _head = ObservableSubscription.create();
    private _tail = ObservableSubscription.create();

    get value() {
        if (stack.length) {
            let co = stack[stack.length - 1];
            if (!co._observables.has(this))
                co._observables.set(this, this.subscribeSneakInLine(co.refresh));
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

    subscribe(callback: (newValue: T, oldValue: T) => any) {
        return ObservableSubscription.createAndPrependToTail(this._tail, callback);
    }

    subscribeInvoke(callback: (newValue: T, oldValue: T) => any) {
        callback(this.wrappedValue, undefined);
        let subscription = ObservableSubscription.createAndPrependToTail(this._tail, callback);
        return subscription;
    }

    private subscribeSneakInLine(callback: (newValue: T, oldValue: T) => any) {
        return ObservableSubscription.createAndAppendToHead(this._head, callback);
    }

    private notifySubscribers(newValue: T, oldValue: T) {
        for (let node = this._head.next; node !== this._tail;) {
            let currentNode = node;
            node = node.next;
            currentNode.callback(newValue, oldValue);
        }
    }

    private notifySubscribersExcept(newValue: T, oldValue: T, exemptedObservableSubscription: ObservableSubscription) {
        for (let node = this._head.next; node !== this._tail;) {
            let currentNode = node;
            node = node.next;
            if (currentNode !== exemptedObservableSubscription)
                currentNode.callback(newValue, oldValue);
        }
    }

    setValueDontNotifyMe(newValue: T, exemptedObservableSubscription: ObservableSubscription) {
        let oldValue = this.wrappedValue;
        if (newValue !== oldValue) {
            this.wrappedValue = newValue;
            this.notifySubscribersExcept(newValue, oldValue, exemptedObservableSubscription);
        }
    }

    invalidate() {
        let value = this.wrappedValue;
        this.notifySubscribers(value, value);
    }

    dispose() {
        delete this.wrappedValue;
        for (let node = this._head.next; node !== this._tail;) {
            let currentNode = node;
            node = node.next;
            currentNode.recycle();
        }
        (this._head.next = this._tail).previous = this._head;
        if (observableBin.length === observableBinLength)
            observableBin.push(this);
        else observableBin[observableBinLength] = this;
        ++observableBinLength;
    }
}

export function o<T>(value?: T): ModifiableObservable<T> {
    if (observableBinLength) {
        var result = <ModifiableObservable<T>>observableBin[--observableBinLength];
        observableBin[observableBinLength] = null;
    }
    else var result = new ModifiableObservable<T>();
    result.wrappedValue = value;
    return result;
}

let computedObservableBin: ComputedObservable<any>[] = [], computedObservableBinLength = 0;

export class ComputedObservable<T> implements Observable<T> {

    constructor() {
        this.dispose = this.dispose.bind(this);
        this.refresh = this.refresh.bind(this);
        (this._head.next = this._tail).previous = this._head;
    }

    wrappedValue: T;

    private _head = ObservableSubscription.create();
    private _tail = ObservableSubscription.create();

    expression: () => T;
    error = null;

    _observables: Map<Observable<T>, ObservableSubscription> = new Map();

    get value() {
        if (stack.length) {
            let co = stack[stack.length - 1];
            if (!co._observables.has(this))
                co._observables.set(this, this.subscribeSneakInLine(co.refresh));
        }
        let error = this.error;
        if (error)
            throw error;
        return this.wrappedValue;
    }

    subscribe(callback: (newValue: T, oldValue: T) => any) {
        return ObservableSubscription.createAndPrependToTail(this._tail, callback);
    }

    subscribeInvoke(callback: (newValue: T, oldValue: T) => any) {
        callback(this.wrappedValue, undefined);
        let subscription = ObservableSubscription.createAndPrependToTail(this._tail, callback);
        return subscription;
    }

    subscribeSneakInLine(callback: (newValue: T, oldValue: T) => any) {
        return ObservableSubscription.createAndAppendToHead(this._head, callback);
    }

    private notifySubscribers(newValue: T, oldValue: T) {
        for (let node = this._head.next; node !== this._tail;) {
            let currentNode = node;
            node = node.next;
            currentNode.callback(newValue, oldValue);
        }
    }

    invalidate() {
        let value = this.wrappedValue;
        this.notifySubscribers(value, value);
    }

    dispose() {
        delete this.wrappedValue;
        delete this.expression;
        delete this.error;
        let observables = this._observables;
        observables.forEach(s => { s.unsubscribeAndRecycle(); });
        observables.clear();
        for (let node = this._head.next; node !== this._tail;) {
            let currentNode = node;
            node = node.next;
            currentNode.recycle();
        }
        (this._head.next = this._tail).previous = this._head;
        if (computedObservableBin.length === computedObservableBinLength)
            computedObservableBin.push(this);
        else computedObservableBin[computedObservableBinLength] = this;
        ++computedObservableBinLength;
    }

    initialize() {
        try {
            stack.push(this);
            try { var result = this.expression(); }
            finally { stack.pop(); }
        }
        catch (e) { this.setValueAndErrorAndNotifySubscribers(undefined, e); return; }
        this.setValueAndErrorAndNotifySubscribers(result, null);
    }

    private setValueAndErrorAndNotifySubscribers(value: T, error) {
        let oldValue = this.wrappedValue, oldError = this.error;
        if (value !== oldValue || error !== oldError) {
            this.wrappedValue = value;
            this.error = error;
            this.notifySubscribers(value, oldValue);
        }
    }

    refresh() {
        let observables = this._observables;
        observables.forEach(s => { s.unsubscribeAndRecycle(); });
        observables.clear();
        this.initialize();
    }
}

export function co<T>(expression: () => T, evaluateAtOnce = true): ComputedObservable<T> {
    if (computedObservableBinLength) {
        var result = <ComputedObservable<T>>computedObservableBin[--computedObservableBinLength];
        computedObservableBin[computedObservableBinLength] = null;
    }
    else var result = new ComputedObservable<T>();
    result.expression = expression;
    if (evaluateAtOnce)
        result.initialize();
    return result;
}

// Each observable keeps a doubly-linked list of subscriptions (callbacks to invoke when a state changes).
// It is a doubly-linked list because insertions and deletions should be fast.
// The doubly-linked list usually has a head and a tail.
// When a subscription is no longer needed, it should be recycled for later usage.
// The bin immediately below keeps references to ready-to-use subscriptions that have been recycled.

let observableSubscriptionBin: ObservableSubscription[] = [], observableSubscriptionBinLength = 0;

export class ObservableSubscription {

    /**
     * Use ObservableSubscription.create() instead.
     * @internal
     */
    constructor() {
        this.unsubscribeAndRecycle = this.unsubscribeAndRecycle.bind(this);
    }

    /**
     * Creates or returns a recycled instance.
     * @internal
     */
    static create() {
        if (observableSubscriptionBinLength) {
            new ObservableSubscription()
            let existing = observableSubscriptionBin[--observableSubscriptionBinLength];
            observableSubscriptionBin[observableSubscriptionBinLength] = null; // Avoids referencing the subscription (thinking of GC; also easier to debug memory leaks)
            return existing;
        }
        else return new ObservableSubscription();
    }

    /**
     * Creates and appends a new subscription to right before the tail.
     * @internal
     */
    static createAndPrependToTail(tail: ObservableSubscription, callback: (...args: any[]) => any) {
        let result = ObservableSubscription.create();
        (result.previous = tail.previous).next = result;
        (result.next = tail).previous = result;
        result.callback = callback;
        return result;
    }

    /**
     * Creates and prepends a new subscription to right after the head.
     * @internal
     */
    static createAndAppendToHead(head: ObservableSubscription, callback: (...args: any[]) => any) {
        let result = ObservableSubscription.create();
        (result.next = head.next).previous = result;
        (result.previous = head).next = result;
        result.callback = callback;
        return result;
    }

    callback: ((...args: any[]) => any);

    /**
     * The previous node in the doubly-linked list.
     * @internal
     */
    previous: ObservableSubscription;

    /**
     * The next node in the doubly-linked list.
     * @internal
     */
    next: ObservableSubscription;

    /**
     * Recycles a subscription (places it in the bin) such that it may be reused.
     * @remarks
     * Use unsubscribeAndRecycle() if you instead wish to both unsubscribe and recycle.
     * @internal
     */
    recycle() {
        delete this.callback;
        delete this.previous;
        delete this.next;
        if (observableSubscriptionBin.length === observableSubscriptionBinLength)
            observableSubscriptionBin.push(this);
        else observableSubscriptionBin[observableSubscriptionBinLength] = this;
        ++observableSubscriptionBinLength;
    }

    /**
     * Use this function if you no longer wish the callback to be invoked.
     * @remarks
     * After invocation, for long-lived scopes, you should expunge any reference you have to it to accommodate the GC.
     */
    unsubscribeAndRecycle() {
        (this.previous.next = this.next).previous = this.previous;
        this.recycle();
    }
}

export function isObservable(obj) {
    return obj instanceof ModifiableObservable || obj instanceof ComputedObservable;
}