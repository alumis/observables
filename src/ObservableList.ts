import { ObservableSubscription, stack } from "./Observable";

export class ObservableList<T> {

    constructor(public iterable?: Iterable<T>) {
        this.dispose = this.dispose.bind(this);
        (this.head.next = this.tail).previous = this.head;
        (this._subscriptionsHead.next = this._subscriptionsTail).previous = this._subscriptionsHead;
        if (iterable)
            for (let i of iterable)
                this.append(i);
    }

    public head: ObservableListNode<T> = {} as any;
    public tail: ObservableListNode<T> = {} as any;

    protected itemToNode = new Map<T, ObservableListNode<T>>();

    private _subscriptionsHead = ObservableSubscription.create();
    private _subscriptionsTail = ObservableSubscription.create();

    append(item: T) {
        let node = this.itemToNode.get(item);
        if (node) {
            if (node.next === this.tail)
                return;
            let previous = node.previous, next = node.next;
            previous.next = next;
            next.previous = previous;
        }
        else this.itemToNode.set(item, node = { item: item } as any);
        (node.previous = this.tail.previous).next = node;
        (node.next = this.tail).previous = node;
        this.notifySubscribers([{ type: ObservableListModificationType.Append, item: item }]);
    }

    remove(item: T) {
        let node = this.itemToNode.get(item);
        if (node) {
            this.itemToNode.delete(item);
            let previous = node.previous, next = node.next;
            previous.next = next;
            next.previous = previous;
            this.notifySubscribers([{ type: ObservableListModificationType.Delete, item: item }]);
        }
    }

    insertBefore(newItem: T, refItem: T) {
        let node = this.itemToNode.get(newItem);
        if (node) {
            let previous = node.previous, next = node.next;
            previous.next = next;
            next.previous = previous;
        }
        else this.itemToNode.set(newItem, node = { item: newItem } as any);
        let refNode: ObservableListNode<T>;
        if (refItem !== null) {
            refNode = this.itemToNode.get(refItem);
            if (!refNode)
                throw new ObservableListRefItemNotFoundError(refItem);
        }
        else refNode = this.tail;
        if (refNode.previous === node)
            return;
        (node.previous = refNode.previous).next = node;
        (node.next = refNode).previous = node;
        this.notifySubscribers([{ type: ObservableListModificationType.InsertBefore, item: newItem, refItem: refItem }]);
    }

    [Symbol.iterator](): Iterator<T> {
        if (stack.length) {
            let co = stack[stack.length - 1];
            if (!co._observables.has(this))
                co._observables.set(this, this.subscribeSneakInLine(co.refresh));
        }
        let node = this.head;
        return {
            next: (): IteratorResult<T> => {
                node = node.next;
                if (node !== this.tail)
                    return { value: node.item, done: false };
                else return { done: true } as any;
            }
        };
    }

    subscribe(action: (modifications: ObservableListModification<T>[]) => any) {
        return ObservableSubscription.createAndPrependToTail(this._subscriptionsTail, action);
    }

    subscribeSneakInLine(action: (modifications: ObservableListModification<T>[]) => any) {
        return ObservableSubscription.createAndAppendToHead(this._subscriptionsHead, action);
    }

    protected notifySubscribers(modifications: ObservableListModification<T>[]) {
        for (let node = this._subscriptionsHead.next; node != this._subscriptionsTail; node = node.next) {
            let currentNode = node;
            node = node.next;
            currentNode.callback(modifications);
        }
    }

    dispose() {
        delete this.head;
        delete this.tail;
        for (let node = this._subscriptionsHead.next; node != this._subscriptionsTail;)
            (node = node.next).previous.recycle();
        this._subscriptionsHead.recycle();
        delete this._subscriptionsHead;
        this._subscriptionsTail.recycle();
        delete this._subscriptionsTail;
    }
}

export interface ObservableListNode<T> {

    previous: ObservableListNode<T>;
    next: ObservableListNode<T>;
    item: T;
}

export interface ObservableListModification<T> {

    type: ObservableListModificationType;
    item: T;
    refItem?: T;
}
export enum ObservableListModificationType {

    Append,
    InsertBefore,
    Delete
}

export class ObservableListRefItemNotFoundError extends Error {
    constructor(refItem) {
        super(`Referenced item '${refItem}' was not found`);
    }
}