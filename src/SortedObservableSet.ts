import { ObservableArray } from "./ObservableArray";
import { ComputedObservable, ObservableSubscription } from "./Observable";
import { ObservableSet } from "./ObservableSet";

export class SortedObservableSet<T> extends ObservableArray<T> {

    constructor(set: ObservableSet<T>, protected compareFn: (a: T, b: T) => number) {

        super(set.toSortedArray(compareFn));

        (this._sortOrderHead.next = this._sortOrderTail).previous = this._sortOrderHead;

        for (let i = 0; i < this.wrappedArray.length; ++i)
            this.createComparison(this.wrappedArray[i], i);

        this._setSubscription = set.subscribe((addedItems, removedItems) => {

            let array = this.wrappedArray;

            for (let item of removedItems) {

                let comparison = this._comparisons.get(item);
                let sortOrder: number = comparison["_sortOrder"];

                comparison.dispose();
                this._comparisons.delete(item);
                array.splice(sortOrder, 1);

                for (let i = sortOrder; i < array.length; ++i)
                    --this._comparisons.get(array[i])["_sortOrder"];

                if (sortOrder < array.length)
                    this._comparisons.get(array[sortOrder]).refresh();

                if (0 <= sortOrder - 1)
                    this._comparisons.get(array[sortOrder - 1]).refresh();

                this.notifySubscribers(null, [item], sortOrder);
            }

            for (let item of addedItems) {

                let sortOrder = binarySearch(array, item, this.compareFn); // Binary search

                // assert(() => sortOrder < 0); // Should return one's complement if it doesn't exist
                sortOrder = ~sortOrder;

                //this.wrappedArray = array = array.slice(0, sortOrder).concat([item], array.slice(sortOrder)); // Inserts at new index

                array.splice(sortOrder, 0, item);

                for (let i = sortOrder + 1; i < array.length; ++i)
                    ++this._comparisons.get(array[i])["_sortOrder"];

                this.createComparison(item, sortOrder);

                if (sortOrder + 1 < array.length)
                    this._comparisons.get(array[sortOrder + 1]).refresh();

                if (0 <= sortOrder - 1)
                    this._comparisons.get(array[sortOrder - 1]).refresh();

                this.notifySubscribers([item], null, sortOrder);
            }
        });
    }

    private _comparisons: Map<T, ComputedObservable<string>> = new Map();

    private _setSubscription: ObservableSubscription;

    private _sortOrderHead = ObservableSubscription.create();
    private _sortOrderTail = ObservableSubscription.create();

    protected notifySortOrderSubscribers(oldSortOrder: number, newSortOrder: number, item: T) {

        for (let node = this._sortOrderHead.next; node != this._sortOrderTail; node = node.next)
            node.action(oldSortOrder, newSortOrder, item);
    }

    subscribeSortOrder(action: (oldSortOrder: number, newSortOrder: number, item: T) => any) {

        return ObservableSubscription.createFromTail(this._sortOrderTail, action);
    }

    private createComparison(item: T, sortOrder: number) {

        let comparison = ComputedObservable.createComputed<string>(() => {

            let sortOrder = comparison["_sortOrder"];

            if (0 < sortOrder) {

                if (sortOrder + 1 < this.wrappedArray.length)
                    return SortedObservableSet.normalizeCompareFn(this.compareFn(item, this.wrappedArray[sortOrder - 1])) + " " + SortedObservableSet.normalizeCompareFn(this.compareFn(this.wrappedArray[sortOrder + 1], item));

                return SortedObservableSet.normalizeCompareFn(this.compareFn(item, this.wrappedArray[sortOrder - 1])) + " 1";
            }

            else if (1 < this.wrappedArray.length)
                return "1 " + SortedObservableSet.normalizeCompareFn(this.compareFn(this.wrappedArray[1], item));

            return "1 1";

        }, false);

        comparison["_sortOrder"] = sortOrder;

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

    private subscribeToComparison(item: T, observable: ComputedObservable<any>) {

        observable.subscribe(() => {

            let sortOrder: number = observable["_sortOrder"];

            if (this.sortOrderChanged(sortOrder)) {

                let array = this.wrappedArray;

                array.splice(sortOrder, 1);

                for (let i = sortOrder; i < array.length; ++i)
                    --this._comparisons.get(array[i])["_sortOrder"];

                let newSortOrder = binarySearch(array, item, this.compareFn); // Binary search

                //assert(() => newSortOrder < 0); // Should return one's complement if it doesn't exist

                newSortOrder = ~newSortOrder;

                //assert(() => sortOrder !== newSortOrder);

                //this.wrappedArray = array = array.slice(0, newSortOrder).concat([item], array.slice(newSortOrder)); // Inserts at new index
                array.splice(newSortOrder, 0, item);

                for (let i = newSortOrder + 1; i < array.length; ++i)
                    ++this._comparisons.get(array[i])["_sortOrder"];

                let oldSortOrder = sortOrder;

                if (newSortOrder < sortOrder)
                    ++sortOrder;

                if (sortOrder < array.length)
                    this._comparisons.get(array[sortOrder]).refresh();

                if (0 <= sortOrder - 1)
                    this._comparisons.get(array[sortOrder - 1]).refresh();

                let comparison = this._comparisons.get(item);

                comparison["_sortOrder"] = newSortOrder;
                comparison.refresh();

                if (0 <= newSortOrder - 1)
                    this._comparisons.get(array[newSortOrder - 1]).refresh();

                if (newSortOrder + 1 < array.length)
                    this._comparisons.get(array[newSortOrder + 1]).refresh();

                this.notifySortOrderSubscribers(oldSortOrder, newSortOrder, item);
            }
        });
    }

    private sortOrderChanged(sortOrder: number) {

        let b: T, c = this.wrappedArray[sortOrder], d: T;

        if (0 <= sortOrder - 1 && 0 < this.compareFn(b = this.wrappedArray[sortOrder - 1], c)) { // c < b

            // c or b has changed at this point

            if (0 <= sortOrder - 2 && 0 < this.compareFn(this.wrappedArray[sortOrder - 2], c)) // c < a
                return true;

            if (sortOrder + 1 < this.wrappedArray.length && 0 < this.compareFn(b, d = this.wrappedArray[sortOrder + 1])) // d < b, which implies b has changed, and not c
                return false;

            return true; // either b or c has changed, no telling which
        }

        if (sortOrder + 1 < this.wrappedArray.length && 0 < this.compareFn(c, d = this.wrappedArray[sortOrder + 1])) { // d < c

            // c or d has changed at this point

            if (sortOrder + 2 < this.wrappedArray.length && 0 < this.compareFn(c, this.wrappedArray[sortOrder + 2])) // e < c
                return true;

            if (0 <= sortOrder - 1 && 0 < this.compareFn(b = this.wrappedArray[sortOrder - 1], d)) // d < b, which implies d has changed, and not c
                return false;

            return true; // either d or c has changed, no telling which
        }

        return false;
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

        this._setSubscription.dispose();
        this._comparisons.forEach(c => { c.dispose(); });
    }
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