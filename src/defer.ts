type Deferred<T> = {
    reject(err: Error): void
    resolve(value: T): void
    promise: Promise<T>
}

export function defer<T>(): Deferred<T> {
    let reject: Deferred<T>['reject']
    let resolve: Deferred<T>['resolve']
    const promise: Deferred<T>['promise'] = new Promise(function (givenResolve, givenReject) {
        resolve = givenResolve
        reject = givenReject
    })
    return { promise, resolve: resolve!, reject: reject! }
}