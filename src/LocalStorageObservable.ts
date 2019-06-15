import { Observable, stack } from "./Observable";

export class LocalStorageObservable<T> extends Observable<T> {

    key: string;

    static createLocalStorage<T>(key: string, defaultValue?: T) {

        let result = <LocalStorageObservable<T>>cache.get(key);

        if (result)
            return result;

        cache.set(key, result = new LocalStorageObservable());

        result.key = key;

        let storageValue = localStorage.getItem(key);

        if (storageValue) {

            try {

                var parsed = JSON.parse(storageValue);
            }

            catch (e) {

                console.error(e);
                result.wrappedValue = defaultValue;

                return;
            }

            result.wrappedValue = parsed;
        }

        else result.wrappedValue = defaultValue;

        return result;
    }

    get value() {

        if (stack.length) {

            let computedObservable = stack[stack.length - 1];

            if (!computedObservable.observables.has(this))
                computedObservable.observables.set(this, this.subscribeSneakInLine(computedObservable.refresh));
        }

        return this.wrappedValue;
    }

    set value(newValue: T) {

        let oldValue = this.wrappedValue;

        if (newValue !== oldValue) {

            this.wrappedValue = newValue;
            localStorage.setItem(this.key, JSON.stringify(newValue));
            this.notifySubscribers(newValue, oldValue);
        }
    }

    refresh() {

        let storageValue = localStorage.getItem(this.key);

        if (storageValue)
            this.value = JSON.parse(storageValue);
    }

    remove() {

        localStorage.removeItem(this.key);
    }

    dispose() {

        delete this.wrappedValue;

        let node = this._prioritizedHead;

        if (node) {

            for (node = node.next; node != this._prioritizedTail; node = node.next)
                node.recycle();

            this._prioritizedHead.recycle();
            delete this._prioritizedHead;

            this._prioritizedTail.recycle();
            delete this._prioritizedTail;
        }

        for (node = this._head.next; node != this._tail; node = node.next)
            node.recycle();

        this._head.recycle();
        delete this._head;

        this._tail.recycle();
        delete this._tail;
    }
}

let cache = new Map<string, LocalStorageObservable<any>>();

(function () {

    let hidden, visibilityChange;

    if (typeof window.document.hidden !== "undefined") { // Opera 12.10 and Firefox 18 and later support

        hidden = "hidden";
        visibilityChange = "visibilitychange";
    }

    else if (typeof window.document["msHidden"] !== "undefined") {

        hidden = "msHidden";
        visibilityChange = "msvisibilitychange";
    }

    else if (typeof window.document["webkitHidden"] !== "undefined") {

        hidden = "webkitHidden";
        visibilityChange = "webkitvisibilitychange";
    }

    window.document.addEventListener(visibilityChange, () => {

        if (!window.document[hidden])
            cache.forEach(v => { v.refresh(); });

    }, false);

})();