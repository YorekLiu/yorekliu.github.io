---
title: TODO
---

- [] dart lang
- [] Jetpack Compose
- [] flutter menus, widgets, rich text, eventchannel and this app maked for blogs
- [] kotlin lang

- [] Jetpack Compose state manager: remember rememberSaver LaunchedEffect rememberUpdatedState DisposableEffect produceState derivedStateOf
- When LaunchedEffect enters the composition it will launch block into the composition's CoroutineContext. The coroutine will be cancelled and re-launched when LaunchedEffect is recomposed with a different key1. The coroutine will be cancelled when the LaunchedEffect leaves the composition. **Just Like scope.launch but compose version**
- rememberUpdatedState should be used when parameters or values computed during composition are referenced by a long-lived lambda or object expression. Recomposition will update the resulting State without recreating the long-lived lambda or object, allowing that object to persist without cancelling and resubscribing, or relaunching a long-lived operation that may be expensive or prohibitive to recreate and restart. This may be common when working with DisposableEffect or LaunchedEffect
- DisposableEffect's: A DisposableEffect's key is a value that defines the identity of the DisposableEffect. If a key changes, the DisposableEffect must dispose its current effect and reset by calling effect again. 
- produceState: Return an observable snapshot State that produces values over time without a defined data source.
- derivedStateOf: Creates a State object whose State.value is the result of calculation. The result of calculation will be cached in such a way that calling State.value repeatedly will not cause calculation to be executed multiple times, but reading State.value will cause all State objects that got read during the calculation to be read in the current Snapshot, meaning that this will correctly subscribe to the derived state objects if the value is being read in an observed context such as a Composable function. Derived states without mutation policy trigger updates on each dependency change. To avoid invalidation on update, provide suitable SnapshotMutationPolicy through derivedStateOf overload.


