export let stack = [];

let observables: Observable<any>[] = [];
let observablesLength = 0;

export class Observable<T> {

    constructor() {

        (this._head.next = this._tail).previous = this._head;

        this.dispose = this.dispose.bind(this);
    }

    static create<T>(value?: T) {

        if (observables.length === observablesLength)
            var result = new Observable<T>();

        else {

            var result = <Observable<T>>observables[--computedObservablesLength];

            computedObservables[computedObservablesLength] = null;
        }

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

    private get prioritizedTail() {

        let value = this._prioritizedTail;

        if (value)
            return value;

        this._prioritizedHead = ObservableSubscription.create();
        this._prioritizedTail = value = ObservableSubscription.create();

        (this._prioritizedHead.next = this._prioritizedTail).previous = this._prioritizedHead;

        return value;
    }

    notifySubscribers(newValue: T, oldValue: T, ) {

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node != this._prioritizedTail; node = node.next)
                node.action(newValue, oldValue);
        }

        for (node = this._head.next; node != this._tail; node = node.next)
            node.action(newValue, oldValue);
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

    dispose() {

        this.wrappedValue = void 0;

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node != this._prioritizedTail; node = node.next)
                node.recycle();

            this._prioritizedHead.recycle();
            this._prioritizedHead = void 0;

            this._prioritizedTail.recycle();
            this._prioritizedTail = void 0;
        }

        for (node = this._head.next; node != this._tail; node = node.next)
            node.recycle();

        (this._head.next = this._tail).previous = this._head;

        if (observables.length === observablesLength)
            observables.push(this);

        else observables[observablesLength] = this;

        ++observablesLength;
    }
}

let observableSubscriptions: ObservableSubscription[] = [];
let observableSubscriptionsLength = 0;

export class ObservableSubscription {

    constructor() {

        this.dispose = this.dispose.bind(this);
    }

    static create() {

        if (observableSubscriptions.length === observableSubscriptionsLength)
            return new ObservableSubscription();

        else {

            let existing = observableSubscriptions[--observableSubscriptionsLength];

            observableSubscriptions[observableSubscriptionsLength] = null;

            return existing;
        }
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

        this.previous = void 0;
        this.next = void 0;
        this.action = void 0;

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

let computedObservables: ComputedObservable<any>[] = [];
let computedObservablesLength = 0;

export class ComputedObservable<T> extends Observable<T> {

    constructor() {

        super();

        this.refresh = this.refresh.bind(this);
    }

    static createComputed<T>(expression: () => T, preEvaluate = true) {

        if (computedObservables.length === computedObservablesLength)
            var result = new ComputedObservable<T>();

        else {

            var result = <ComputedObservable<T>>computedObservables[--computedObservablesLength];

            computedObservables[computedObservablesLength] = null;
        }

        result.expression = expression;

        if (preEvaluate)
            result.wrappedValue = result.evaluateExpression();

        return result;
    }

    expression: () => T;

    evaluateExpression() {

        stack.push(this);

        try {

            return this.expression();
        }

        finally {

            stack.pop();
        }
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

        this.expression = void 0;
        this.wrappedValue = void 0;
        this.observables.clear();

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node != this._prioritizedTail; node = node.next)
                node.recycle();

            this._prioritizedHead.recycle();
            this._prioritizedHead = void 0;

            this._prioritizedTail.recycle();
            this._prioritizedTail = void 0;
        }

        for (node = this._head.next; node != this._tail; node = node.next)
            node.recycle();

        (this._head.next = this._tail).previous = this._head;

        if (computedObservables.length === computedObservablesLength)
            computedObservables.push(this);

        else computedObservables[computedObservablesLength] = this;

        ++computedObservablesLength;
    }
}

export function whenAsync(expression: () => boolean) {

    let value = this.value;

    if (expression())
        return Promise.resolve(value);

    return new Promise(r => {

        let computedObservable = ComputedObservable.createComputed(expression);

        computedObservable.subscribe(n => {

            if (n) {

                computedObservable.dispose();
                r(n);
            }
        });
    });
}

export function alwaysWhen(expression: () => boolean, callback: () => any) {

    let result = ComputedObservable.createComputed(expression);

    result.subscribeInvoke(n => {
        if (n)
            callback();
    });

    return result;
}