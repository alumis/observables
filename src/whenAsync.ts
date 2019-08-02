import { co } from "./Observable";

export function whenAsync(expression: () => boolean) {
    return new Promise((resolve, reject) => {
        let o = co(() => {
            try {
                return expression();
            }
            catch (e) {
                o.dispose();
                reject(e);
            }
        });
        o.subscribeInvoke(n => {
            if (n) {
                o.dispose();
                resolve(n);
            }
        });
    });
}