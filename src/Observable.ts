var observables: Observable<any>[] = [];
var observablesLength = 0;

function recycleObservable<T>(observable: Observable<T>) {

    observable.wrappedValue = void 0;

    var node = observable._prioritizedHead;

    if (node) {

        for (node = node.next; node != observable._prioritizedTail; node = node.next)
            recycleObservableSubscription(node);

        recycleObservableSubscription(observable._prioritizedHead);
        observable._prioritizedHead = void 0;

        recycleObservableSubscription(observable._prioritizedTail);
        observable._prioritizedTail = void 0;
    }

    for (node = observable._head.next; node != observable._tail; node = node.next)
        recycleObservableSubscription(node);

    (observable._head.next = observable._tail).previous = observable._head;

    if (observables.length === observablesLength)
        observables.push(observable);

    else observables[observablesLength] = observable;

    ++observablesLength;
}

var stack = [];

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

    _head = requestObservableSubscription();
    _tail = requestObservableSubscription();

    _prioritizedHead: ObservableSubscription;
    _prioritizedTail: ObservableSubscription;

    get value() {

        if (0 < stack.length) {

            var computedObservable = <ComputedObservable<T>>stack[stack.length - 1];

            if (!computedObservable.observables.has(this))
                computedObservable.observables.set(this, this.subscribeSneakInLine(computedObservable.refresh));
        }

        return this.wrappedValue;
    }

    set value(newValue: T) {

        var oldValue = this.wrappedValue;

        if (newValue !== oldValue) {

            this.wrappedValue = newValue;
            this.notifySubscribers(newValue, oldValue);
        }
    }

    private get prioritizedTail() {

        var value = this._prioritizedTail;

        if (value)
            return value;

         this._prioritizedHead = requestObservableSubscription();
         this._prioritizedTail = value = requestObservableSubscription();

         (this._prioritizedHead.next = this._prioritizedTail).previous = this._prioritizedHead;

         return value;
    }

    notifySubscribers(newValue: T, oldValue: T,) {

        var node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node != this._prioritizedTail; node = node.next)
                node.action(newValue, oldValue);
        }

        for (node = this._head.next; node != this._tail; node = node.next)
            node.action(newValue, oldValue);
    }

    invalidate() {

        var value = this.wrappedValue;

        this.notifySubscribers(value, value);
    }

    subscribe(action: (newValue: T, oldValue: T,) => any) {

        return ObservableSubscription.createFromTail(this._tail, action);
    }

    subscribeInvoke(action: (newValue: T, oldValue: T,) => any) {

        action(this.wrappedValue, void 0);

        var subscription = ObservableSubscription.createFromTail(this._tail, action);

        return subscription;
    }
    
    prioritizedSubscribe(action: (newValue: T, oldValue: T,) => any) {

        return ObservableSubscription.createFromTail(this.prioritizedTail, action);
    }

    prioritizedSubscribeInvoke(action: (newValue: T, oldValue: T,) => any) {

        action(this.wrappedValue, this.wrappedValue);

        var subscription = ObservableSubscription.createFromTail(this.prioritizedTail, action);

        return subscription;
    }

    subscribeSneakInLine(action: (newValue: T, oldValue: T,) => any) {

        return ObservableSubscription.createFromHead(this._head, action);
    }

    dispose() {

        recycleObservable(this);
    }
}

var observableSubscriptions: ObservableSubscription[] = [];
var observableSubscriptionsLength = 0;

function recycleObservableSubscription(subscription: ObservableSubscription) {

    subscription.previous = void 0;
    subscription.next = void 0;
    subscription.action = void 0;

    if (observableSubscriptions.length === observableSubscriptionsLength)
        observableSubscriptions.push(subscription);

    else observableSubscriptions[observableSubscriptionsLength] = subscription;

    ++observableSubscriptionsLength;
}

function requestObservableSubscription() {

    if (observableSubscriptions.length === observableSubscriptionsLength)
        return new ObservableSubscription();
    
    else {

        var existing = observableSubscriptions[--observableSubscriptionsLength];

        observableSubscriptions[observableSubscriptionsLength] = null;

        return existing;
    }
}

export class ObservableSubscription {

    constructor() {

        this.dispose = this.dispose.bind(this);
    }

    static createFromTail(tail: ObservableSubscription, action: (...args: any[]) => any) {

        var result = requestObservableSubscription();

        (result.previous = tail.previous).next = result;
        (result.next = tail).previous = result;

        result.action = action;

        return result;
    }

    static createFromHead(head: ObservableSubscription, action: (...args: any[]) => any) {

        var result = requestObservableSubscription();

        (result.next = head.next).previous = result;
        (result.previous = head).next = result;

        result.action = action;

        return result;
    }

    previous: ObservableSubscription;
    next: ObservableSubscription;

    action: ((...args: any[]) => any);

    dispose() {

        (this.previous.next = this.next).previous = this.previous;
        recycleObservableSubscription(this);
    }
}

var computedObservables: ComputedObservable<any>[] = [];
var computedObservablesLength = 0;

function recycleComputedObservable<T>(computedObservable: ComputedObservable<T>) {

    computedObservable.expression = void 0;
    computedObservable.wrappedValue = void 0;
    computedObservable.observables.clear();

    var node = computedObservable._prioritizedHead;

    if (node) {

        for (node = node.next; node != computedObservable._prioritizedTail; node = node.next)
            recycleObservableSubscription(node);

        recycleObservableSubscription(computedObservable._prioritizedHead);
        computedObservable._prioritizedHead = void 0;

        recycleObservableSubscription(computedObservable._prioritizedTail);
        computedObservable._prioritizedTail = void 0;
    }

    for (node = computedObservable._head.next; node != computedObservable._tail; node = node.next)
        recycleObservableSubscription(node);

    (computedObservable._head.next = computedObservable._tail).previous = computedObservable._head;

    if (computedObservables.length === computedObservablesLength)
        computedObservables.push(computedObservable);

    else computedObservables[computedObservablesLength] = computedObservable;

    ++computedObservablesLength;
}

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

        var observables = this.observables;

        observables.forEach(s => { s.dispose(); });
        this.observables.clear();

        var oldValue = this.wrappedValue, newValue = this.evaluateExpression();

        if (newValue !== oldValue) {

            this.wrappedValue = newValue;
            this.notifySubscribers(newValue, oldValue);
        }
    }

    get value() {

        if (0 < stack.length) {

            var computedObservable = <ComputedObservable<T>>stack[stack.length - 1];

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
        recycleComputedObservable(this);
    }
}

export function whenAsync(expression: () => boolean) {

    var value = this.value;

    if (expression())
        return Promise.resolve(value);

    return new Promise(r => {

        var computedObservable = ComputedObservable.createComputed(expression);

        computedObservable.subscribe(n => {

            if (n) {

                computedObservable.dispose();
                r(n);
            }
        });
    });
}

export function alwaysWhen(expression: () => boolean, callback: () => any) {

    return ComputedObservable.createComputed(expression).subscribeInvoke(n => {
        if (n)
            callback();
    });
}