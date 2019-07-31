// Each observable keeps a doubly-linked list of subscriptions (callbacks to invoke when a state changes).
// It is a doubly-linked list because insertions and deletions should be fast.
// The doubly-linked list usually has a head and a tail.
// When a subscription is no longer needed, it should be recycled for later usage.
// The bin immediately below keeps references to ready-to-use subscriptions that have been recycled.

let bin: ObservableSubscription[] = [], binLength = 0;

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
        if (binLength) { new ObservableSubscription()
            let existing = bin[--binLength];
            bin[binLength] = null; // Avoids referencing the subscription (thinking of GC; also easier to debug memory leaks)
            return existing;
        }
        else return new ObservableSubscription();
    }

    /**
     * Creates and appends a new subscription to right before the tail.
     * @internal
     */
    static createAndAppend(tail: ObservableSubscription, callback: (...args: any[]) => any) {
        let result = ObservableSubscription.create();
        (result._previous = tail._previous)._next = result;
        (result._next = tail)._previous = result;
        result.callback = callback;
        return result;
    }

    /**
     * Creates and prepends a new subscription to right after the head.
     * @internal
     */
    static createFromHead(head: ObservableSubscription, callback: (...args: any[]) => any) {
        let result = ObservableSubscription.create();
        (result._next = head._next)._previous = result;
        (result._previous = head)._next = result;
        result.callback = callback;
        return result;
    }

    callback: ((...args: any[]) => any);

    /**
     * The previous node in this doubly-linked list.
     * @internal
     */
    _previous: ObservableSubscription;

    /**
     * The next node in this doubly-linked list.
     * @internal
     */
    _next: ObservableSubscription;

    /**
     * Recycles a subscription (places it in the bin) such that it may be reused.
     * @remarks
     * Use unsubscribeAndRecycle() if you instead wish to both unsubscribe and recycle.
     * @internal
     */
    recycle() {
        delete this.callback;
        delete this._previous;
        delete this._next;
        if (bin.length === binLength)
            bin.push(this);
        else bin[binLength] = this;
        ++binLength;
    }

    /**
     * Use this function if you no longer wish the callback to be invoked.
     * @remarks
     * After invocation, for long-lived scopes, you should expunge any reference you have to it to be nice to the GC.
     */
    unsubscribeAndRecycle() {
        (this._previous._next = this._next)._previous = this._previous;
        this.recycle();
    }
}