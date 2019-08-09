import { CancellationToken } from "@alumis/utils/src/CancellationToken";
import { OperationCancelledError } from "@alumis/utils/src/OperationCancelledError";
import { co } from "./Observable";

export function whenAsync(expression: () => boolean, cancellationToken?: CancellationToken) {
    if (cancellationToken) {
        return new Promise((resolve, reject) => {
            let listener: () => void, notRejected = true, o = co(() => {
                try {
                    return expression();
                }
                catch (e) {
                    if (listener)
                        cancellationToken.removeListener(listener);
                    else notRejected = false;
                    o.dispose();
                    reject(e);
                }
            });
            if (notRejected) {
                listener = () => {
                    o.dispose();
                    reject(new OperationCancelledError());
                };
                cancellationToken.addListener(listener);
                o.subscribeInvoke(n => {
                    if (n) {
                        cancellationToken.removeListener(listener);
                        o.dispose();
                        resolve(n);
                    }
                });
            }
        });
    }
    else {
        return new Promise((resolve, reject) => {
            let notRejected = true, o = co(() => {
                try {
                    return expression();
                }
                catch (e) {
                    notRejected = false;
                    o.dispose();
                    reject(e);
                }
            });
            if (notRejected) {
                o.subscribeInvoke(n => {
                    if (n) {
                        o.dispose();
                        resolve(n);
                    }
                });
            }
        });
    }
}