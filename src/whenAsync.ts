import { co } from "./Observable";

export function whenAsync(expression: () => boolean) {
    try { var value = expression(); }
    catch (e) { return Promise.reject(value); }
    if (value)
        return Promise.resolve(value);
    return new Promise((resolve, reject) => {
        let o = co(() => {
            try {
                return expression();
            }
            catch (e) {
                o.dispose();
                reject(e);
            }
        }, false);
        o.wrappedValue = value;
        o.subscribe(n => {
            if (n) {
                o.dispose();
                resolve(n);
            }
        });
    });
}