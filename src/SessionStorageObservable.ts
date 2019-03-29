import { Observable, stack } from "./Observable";

export class SessionStorageObservable<T> extends Observable<T> {

    key: string;

    static createSessionStorage<T>(key: string, defaultValue?: T) {

        let result = <SessionStorageObservable<T>>cache.get(key);

        if (result)
            return result;

        cache.set(key, result = new SessionStorageObservable());

        result.key = key;

        let storageValue = sessionStorage.getItem(key);

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
            sessionStorage.setItem(this.key, JSON.stringify(newValue));
            this.notifySubscribers(newValue, oldValue);
        }
    }

    refresh() {

        let storageValue = sessionStorage.getItem(this.key);

        if (storageValue)
            this.value = JSON.parse(storageValue);
    }

    remove() {

        sessionStorage.removeItem(this.key);
    }

    dispose() {

        super.dispose(false);
    }
}

let cache = new Map<string, SessionStorageObservable<any>>();