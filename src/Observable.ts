import { ObservableSubscription } from "./ObservableSubscription";

let observableBin: Observable<any>[] = [], observableBinLength = 0;

let stack: Array<ComputedObservable<any>> = [];

export interface IObservable<T> {

    value: T;
    wrappedValue: T;
    subscribe(callback: (newValue: T, oldValue: T) => any);
    subscribeInvoke(callback: (newValue: T, oldValue: T) => any);
    invalidate();
    dispose();
}

export interface IModifiableObservable<T> extends IObservable<T> {

    setValueDontNotifyMe(newValue: T, exemptedObservableSubscription: ObservableSubscription);
}

class Observable<T> implements IModifiableObservable<T> {

    constructor() {
        (this._head._next = this._tail)._previous = this._head;
        this.dispose = this.dispose.bind(this);
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
        return ObservableSubscription.createAndAppend(this._tail, callback);
    }

    subscribeInvoke(callback: (newValue: T, oldValue: T) => any) {
        callback(this.wrappedValue, undefined);
        let subscription = ObservableSubscription.createAndAppend(this._tail, callback);
        return subscription;
    }

    private subscribeSneakInLine(callback: (newValue: T, oldValue: T) => any) {
        return ObservableSubscription.createFromHead(this._head, callback);
    }

    private notifySubscribers(newValue: T, oldValue: T) {
        if (stack.length) {
            let oldStack = stack;
            stack = [];
            try {
                for (let node = this._head._next; node !== this._tail;) {
                    let currentNode = node;
                    node = node._next;
                    currentNode.callback(newValue, oldValue);
                }
            }
            finally { stack = oldStack; }
        }
        else {
            for (let node = this._head._next; node !== this._tail;) {
                let currentNode = node;
                node = node._next;
                currentNode.callback(newValue, oldValue);
            }
        }
    }

    private notifySubscribersExcept(newValue: T, oldValue: T, exemptedObservableSubscription: ObservableSubscription) {
        if (stack.length) {
            let oldStack = stack;
            stack = [];
            try {
                for (let node = this._head._next; node !== this._tail;) {
                    let currentNode = node;
                    node = node._next;
                    if (currentNode !== exemptedObservableSubscription)
                        currentNode.callback(newValue, oldValue);
                }
            }
            finally { stack = oldStack; }
        }
        else {
            for (let node = this._head._next; node !== this._tail;) {
                let currentNode = node;
                node = node._next;
                if (currentNode !== exemptedObservableSubscription)
                    currentNode.callback(newValue, oldValue);
            }
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

    toString() {
        return String(this.value);
    }

    dispose() {
        delete this.wrappedValue;
        for (let node = this._head._next; node !== this._tail;) {
            node = node._next;
            node._previous.recycle();
        }
        (this._head._next = this._tail)._previous = this._head;
        if (observableBin.length === observableBinLength)
            observableBin.push(this);
        else observableBin[observableBinLength] = this;
        ++observableBinLength;
    }
}

export function o<T>(value?: T): IModifiableObservable<T> {
    if (observableBinLength) {
        var result = <Observable<T>>observableBin[--observableBinLength];
        observableBin[observableBinLength] = null;
    }
    else var result = new Observable<T>();
    result.wrappedValue = value;
    return result;
}

let computedObservableBin: ComputedObservable<any>[] = [], computedObservableBinLength = 0;

export interface IComputedObservable<T> extends IObservable<T> {

    expression: () => T;
    error;
    evaluate();
}

class ComputedObservable<T> implements IObservable<T> {

    constructor() {
        this.refresh = this.refresh.bind(this);
    }

    wrappedValue: T;

    private _head = ObservableSubscription.create();
    private _tail = ObservableSubscription.create();

    expression: () => T;
    error = null;

    _observables: Map<IObservable<T>, ObservableSubscription> = new Map();

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
        return ObservableSubscription.createAndAppend(this._tail, callback);
    }

    subscribeInvoke(callback: (newValue: T, oldValue: T) => any) {
        callback(this.wrappedValue, undefined);
        let subscription = ObservableSubscription.createAndAppend(this._tail, callback);
        return subscription;
    }

    subscribeSneakInLine(callback: (newValue: T, oldValue: T) => any) {
        return ObservableSubscription.createFromHead(this._head, callback);
    }

    private notifySubscribers(newValue: T, oldValue: T) {
        if (stack.length) {
            let oldStack = stack;
            stack = [];
            try {
                for (let node = this._head._next; node !== this._tail;) {
                    let currentNode = node;
                    node = node._next;
                    currentNode.callback(newValue, oldValue);
                }
            }
            finally { stack = oldStack; }
        }
        else {
            for (let node = this._head._next; node !== this._tail;) {
                let currentNode = node;
                node = node._next;
                currentNode.callback(newValue, oldValue);
            }
        }
    }

    invalidate() {
        let value = this.wrappedValue;
        this.notifySubscribers(value, value);
    }

    toString() {
        return String(this.value);
    }

    dispose() {
        delete this.wrappedValue;
        delete this.expression;
        delete this.error;
        let observables = this._observables;
        observables.forEach(s => { s.unsubscribeAndRecycle(); });
        observables.clear();
        for (let node = this._head._next; node !== this._tail;) {
            node = node._next;
            node._previous.recycle();
        }
        (this._head._next = this._tail)._previous = this._head;
        if (computedObservableBin.length === computedObservableBinLength)
            computedObservableBin.push(this);
        else computedObservableBin[computedObservableBinLength] = this;
        ++computedObservableBinLength;
    }

    evaluate() {
        try {
            stack.push(this);
            try { var result = this.expression(); }
            finally { stack.pop(); }
        }
        catch (e) { this.setValueAndError(undefined, e); return; }
        this.setValueAndError(result, null);
    }

    private setValueAndError(value: T, error) {
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
        this.evaluate();
    }
}

export function co<T>(expression: () => T, evaluateAtOnce = true): IComputedObservable<T> {
    if (computedObservableBinLength) {
        var result = <ComputedObservable<T>>computedObservableBin[--computedObservableBinLength];
        computedObservableBin[computedObservableBinLength] = null;
    }
    else var result = new ComputedObservable<T>();
    result.expression = expression;
    if (evaluateAtOnce)
        result.evaluate();
    return result;
}