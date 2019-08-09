import { o } from "./Observable";

export var navigatorOnLine = o(navigator.onLine);

window.addEventListener("offline", () => { navigatorOnLine.value = false; });
window.addEventListener("online", () => { navigatorOnLine.value = true; });