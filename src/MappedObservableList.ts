import { ObservableSubscription } from "./Observable";
import { ObservableList, ObservableListNode, ObservableListModification, ObservableListModificationType } from "./ObservableList";

export class MappedObservableList<T, U> extends ObservableList<U> {

    constructor(protected sourceList: ObservableList<T>, protected callbackfn: (value: T) => U) {
        super();
        for (let node = sourceList.head.next; node !== sourceList.tail; node = node.next) {
            let mappedItem = callbackfn(node.item);
            this.append(mappedItem);
            this._map.set(node.item, mappedItem);
        }
        this._subscription = sourceList.subscribe(modifications => {
            let mappedModifications: ObservableListModification<U>[] = [];
            for (let m of modifications) {
                switch (m.type) {
                    case ObservableListModificationType.Append: {
                        let mappedItem = this.callbackfn(m.item), node = { item: mappedItem } as any;
                        this.itemToNode.set(mappedItem, node);
                        (node.previous = this.tail.previous).next = node;
                        (node.next = this.tail).previous = node;
                        mappedModifications.push({ type: ObservableListModificationType.Append, item: mappedItem });
                        this._map.set(m.item, mappedItem);
                        break;
                    }
                    case ObservableListModificationType.InsertBefore: {
                        let node: ObservableListNode<U>, mappedItem = this._map.get(m.item);
                        if (mappedItem) {
                            node = this.itemToNode.get(mappedItem);
                            let previous = node.previous, next = node.next;
                            previous.next = next;
                            next.previous = previous;
                        }
                        else {
                            mappedItem = this.callbackfn(m.item);
                            this.itemToNode.set(mappedItem, node = { item: mappedItem } as any);
                            this._map.set(m.item, mappedItem);
                        }
                        let refNode: ObservableListNode<U>, refItem: U;
                        if (m.refItem !== null)
                            refNode = this.itemToNode.get(refItem = this._map.get(m.refItem));
                        else {
                            refNode = this.tail;
                            refItem = null;
                        }
                        if (refNode.previous === node)
                            return;
                        (node.previous = refNode.previous).next = node;
                        (node.next = refNode).previous = node;
                        mappedModifications.push({ type: ObservableListModificationType.InsertBefore, item: mappedItem, refItem: refItem });
                        break;
                    }
                    case ObservableListModificationType.Delete: {
                        let mappedItem = this._map.get(m.item), node = this.itemToNode.get(mappedItem);
                        this.itemToNode.delete(mappedItem);
                        let previous = node.previous, next = node.next;
                        previous.next = next;
                        next.previous = previous;
                        this._map.delete(m.item);
                        mappedModifications.push({ type: ObservableListModificationType.Delete, item: mappedItem });
                        break;
                    }
                }
                this.notifySubscribers(mappedModifications);
            }
        });
    }

    private _map = new Map<T, U>();
    private _subscription: ObservableSubscription;

    dispose() {
        super.dispose();
        delete this._map;
        this._subscription.unsubscribeAndRecycle();
        delete this._subscription;
    }
}

declare module "./ObservableList" {
    interface ObservableList<T> {
        map<U>(callbackfn: (value: T) => U): MappedObservableList<T, U>;
        mapDisposeSourceWhenDisposed<U>(callbackfn: (value: T) => U): MappedObservableList<T, U>;
    }
}

ObservableList.prototype.map = function <T, U>(callbackfn: (value: T) => U) {
    return new MappedObservableList(this, callbackfn);
};

ObservableList.prototype.mapDisposeSourceWhenDisposed = function <T, U>(callbackfn: (value: T) => U) {
    let result = new MappedObservableList(this, callbackfn);
    result.dispose = () => { result.dispose(); this.dispose(); };
    return result;
};