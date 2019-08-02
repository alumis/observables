import { ObservableList, ObservableListNode, ObservableListModification, ObservableListModificationType } from "./ObservableList";
import { ObservableSet } from "./ObservableSet";
import { IComputedObservable, ObservableSubscription, co } from "./Observable";

export class SortedObservableSet<T> extends ObservableList<T> {

    constructor(protected sourceSet: ObservableSet<T>, protected compareFn: (a: T, b: T) => number) {
        super();
        this.reflow = this.reflow.bind(this);
        let sorted: T[] = [];
        for (let i of sourceSet.wrappedSet)
            sorted.push(i);
        for (let i of sorted.sort(compareFn))
            this.append(i);
        for (let node = this.head.next; node !== this.tail; node = node.next)
            this.createComparison(node);
        this._subscription = sourceSet.subscribe((addedItems, removedItems) => {
            let modifications: ObservableListModification<T>[] = [];
            let newNodes: ObservableListNode<T>[] = [];
            if (addedItems) {
                for (let i of addedItems) {
                    for (let refNode = this.head.next; ; refNode = refNode.next) {
                        if (refNode === this.tail || this.compareFn(i, refNode.item) < 0) {
                            let node = { item: i } as any;
                            this.itemToNode.set(i, node);
                            (node.previous = refNode.previous).next = node;
                            (node.next = refNode).previous = node;
                            modifications.push({ type: ObservableListModificationType.InsertBefore, item: i, refItem: refNode.item });
                            newNodes.push(node);
                            break;
                        }
                    }
                }
            }
            let previousAndNext: ObservableListNode<T>[] = [];
            if (removedItems) {
                for (let i of removedItems) {
                    let node = this.itemToNode.get(i), previous = node.previous, next = node.next;
                    previous.next = next;
                    next.previous = previous;
                    this.itemToNode.delete(i);
                    this._comparisons.get(node).dispose();
                    this._comparisons.delete(node);
                    modifications.push({ type: ObservableListModificationType.Delete, item: i });
                    previousAndNext.push(previous, next);
                }
            }
            let visitedNodes = new Set<ObservableListNode<T>>();
            for (let n of newNodes) {
                visitedNodes.add(n);
                this.createComparison(n);
                if (n.previous !== this.head && !visitedNodes.has(n.previous)) {
                    this._comparisons.get(n.previous).refresh();
                    visitedNodes.add(n.previous);
                }
                if (n.next !== this.tail && !visitedNodes.has(n.next)) {
                    this._comparisons.get(n.next).refresh();
                    visitedNodes.add(n.next);
                }
            }
            for (let n of previousAndNext) {
                if (!visitedNodes.has(n.previous) && this.itemToNode.get(n.item)) {
                    this._comparisons.get(n).refresh();
                    visitedNodes.add(n);
                }
            }
            this.notifySubscribers(modifications);
        });
    }

    private _comparisons = new Map<ObservableListNode<T>, IComputedObservable<string>>();
    private _subscription: ObservableSubscription;

    private createComparison(node: ObservableListNode<T>) {
        let o = co(() => {
            if (node.previous !== this.head) {
                if (node.next !== this.tail)
                    return normalizeComparison(this.compareFn(node.item, node.previous.item)) + " " + normalizeComparison(this.compareFn(node.next.item, node.item));
                else return normalizeComparison(this.compareFn(node.item, node.previous.item)) + " 1";
            }
            else if (node.next !== this.tail)
                return "1 " + normalizeComparison(this.compareFn(node.next.item, node.item));
            else return "1 1";
        });
        o.subscribe(this.reflow);
        this._comparisons.set(node, o);
    }

    private _reflowHandle: number;
    private _synchronizationPromise: Promise<void>;
    private _resolveSynchronizationpromise: () => void;

    private reflow() {
        if (this._reflowHandle)
            return;
        this._reflowHandle = setTimeout(() => {
            let sorted: T[] = [];
            for (let i of this.sourceSet.wrappedSet)
                sorted.push(i);
            let unsortedNode = this.head.next;
            let modifications: ObservableListModification<T>[] = [];
            let nodesToRefreshList: ObservableListNode<T>[] = [];
            for (let i of sorted.sort(this.compareFn)) {
                let sortedNode = this.itemToNode.get(i);
                if (sortedNode !== unsortedNode) {
                    // Detach sorted node
                    let previous = sortedNode.previous, next = sortedNode.next;
                    previous.next = next;
                    next.previous = previous;
                    // Insert sorted node before unsorted node
                    (sortedNode.previous = unsortedNode.previous).next = sortedNode;
                    sortedNode.next = unsortedNode;
                    unsortedNode.previous = sortedNode;
                    modifications.push({ type: ObservableListModificationType.InsertBefore, item: sortedNode.item, refItem: unsortedNode.item });
                    nodesToRefreshList.push(sortedNode);
                }
                else unsortedNode = unsortedNode.next;
            }
            let visitedNodes = new Set<ObservableListNode<T>>();
            for (let n of nodesToRefreshList) {
                visitedNodes.add(n);
                this._comparisons.get(n).refresh();
                if (n.previous !== this.head && !visitedNodes.has(n.previous)) {
                    this._comparisons.get(n.previous).refresh();
                    visitedNodes.add(n.previous);
                }
                if (n.next !== this.tail && !visitedNodes.has(n.next)) {
                    this._comparisons.get(n.next).refresh();
                    visitedNodes.add(n.next);
                }
            }
            delete this._reflowHandle;
            this.notifySubscribers(modifications);
            if (this._synchronizationPromise) {
                let resolve = this._resolveSynchronizationpromise;
                delete this._synchronizationPromise;
                delete this._resolveSynchronizationpromise;
                resolve();
            }
        }, 0);
    }

    synchronizeAsync() {
        if (this._reflowHandle)
            return this._synchronizationPromise || (this._synchronizationPromise = new Promise((resolve, reject) => { this._resolveSynchronizationpromise = resolve; }));
        else return Promise.resolve();
    }

    dispose() {
        super.dispose();
        this._comparisons.forEach(o => { o.dispose(); });
        delete this._comparisons;
        this._subscription.unsubscribeAndRecycle();
        delete this._subscription;
    }
}

function normalizeComparison(n: number) {
    if (n < 0)
        return -1;
    if (n === 0)
        return 0;
    if (0 < n)
        return 1;
    return NaN;
}

declare module "./ObservableSet" {
    interface ObservableSet<T> {
        sort(compareFn: (a: T, b: T) => number): SortedObservableSet<T>;
        sortDisposeSourceWhenDisposed(compareFn: (a: T, b: T) => number): SortedObservableSet<T>;
    }
}

ObservableSet.prototype.sort = function <T>(compareFn: (a: T, b: T) => number) {
    return new SortedObservableSet(this, compareFn);
};

ObservableSet.prototype.sortDisposeSourceWhenDisposed = function <T>(compareFn: (a: T, b: T) => number) {
    let result = new SortedObservableSet(this, compareFn);
    result.dispose = () => { result.dispose(); this.dispose(); };
    return result;
};