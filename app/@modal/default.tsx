/**
 * The modal slot renders nothing unless a place route has been intercepted.
 * Next requires a default for a parallel slot so that a cold load of `/` (or a
 * refresh on any non-intercepted route) has something to render here.
 */
export default function ModalDefault() {
    return null;
}
