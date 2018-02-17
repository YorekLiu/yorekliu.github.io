---
title: "RxJava,了解一下"
excerpt: "RxJava是最流行的异步操作、响应式编程框架了，其最大的优点就是简洁(代码在逻辑上非常易懂)。来了解一下吧"
categories:
  - Android
tags:
  - RxJava
header:
  teaser: /assets/images/fragment_lifecycle.png
  overlay_image: /assets/images/fragment_lifecycle.png
  overlay_filter: 0.5
  cta_url: "https://github.com/ReactiveX/RxJava"
toc: true
toc_label: "目录"
toc_icon: "heart"
---


---
## 3 RxJava中的操作符
### 3.1 [阻塞操作](https://github.com/ReactiveX/RxJava/wiki/Blocking-Observable-Operators)
当阻塞的`Observables`执行完成后，其他代码才能执行.

- [forEach](http://reactivex.io/documentation/operators/subscribe.html) - invoke a function on each item emitted by the Observable; block until the Observable completes
- [first/firstOrDefault](http://reactivex.io/documentation/operators/first.html) - block until the Observable emits an item, then return the first item emitted by the Observable or a default item if the Observable did not emit an item
  ![rxjava_first]({{ basepath }}/assets/images/rxjava_first.png)
- [last/lastOrDefault](http://reactivex.io/documentation/operators/last.html) - block until the Observable completes, then return the last item emitted by the Observable or a default item if there is no last item
  ![rxjava_last]({{ basepath }}/assets/images/rxjava_last.png)
- [mostRecent](http://reactivex.io/documentation/operators/first.html) - returns an iterable that always returns the item most recently emitted by the Observable
- [next](http://reactivex.io/documentation/operators/takelast.html) - returns an iterable that blocks until the Observable emits another item, then returns that item
- [latest](http://reactivex.io/documentation/operators/first.html) - returns an iterable that blocks until or unless the Observable emits an item that has not been returned by the iterable, then returns that item
- [single](http://reactivex.io/documentation/operators/first.html) - if the Observable completes after emitting a single item, return that item, otherwise throw an exception
- [singleOrDefault](http://reactivex.io/documentation/operators/first.html) - if the Observable completes after emitting a single item, return that item, otherwise return a default item
- [toFuture](http://reactivex.io/documentation/operators/to.html) - convert the Observable into a Future
  ![rxjava_to]({{ basepath }}/assets/images/rxjava_to.png)
- [toIterable](http://reactivex.io/documentation/operators/to.html) - convert the sequence emitted by the Observable into an Iterable
- [getIterator](http://reactivex.io/documentation/operators/to.html) - convert the sequence emitted by the Observable into an Iterator

示例代码
```java
Observable.just(1, 2, 3).observeOn(Schedulers.io()).blockingForEach(new Consumer<Integer>() {
    @Override
    public void accept(Integer integer) throws Exception {
        Log.e(TAG, integer + " - " + Thread.currentThread().getName());
    }
});
Log.e(TAG, "done - " + Thread.currentThread().getName());
```
结果  
```
02-12 16:33:13.083 7539-7539/? E/RxJavaActivity: 1 - main
02-12 16:33:13.083 7539-7539/? E/RxJavaActivity: 2 - main
02-12 16:33:13.083 7539-7539/? E/RxJavaActivity: 3 - main
02-12 16:33:13.087 7539-7539/? E/RxJavaActivity: done - main

```

> **注意**: RxJava2中针对此部分有了变化：  
> *toBlocking().y - inlined as blockingY() operators, except toFuture*  
> 也就是说，在RxJava2中使用上述操作符，应该是这样的`Observable.just(...).blockingForEach`。即使用时加上前缀`blockingXXX`

### 3.2 [组合操作](https://github.com/ReactiveX/RxJava/wiki/Combining-Observables)
- [startWith](http://reactivex.io/documentation/operators/startwith.html) - emit a specified sequence of items before beginning to emit the items from the Observable
  ![rxjava_startwith]({{ basepath }}/assets/images/rxjava_startwith.png)
- [merge](http://reactivex.io/documentation/operators/merge.html) - combine multiple Observables into one
  ![rxjava_merge]({{ basepath }}/assets/images/rxjava_merge.png)
- [mergeDelayError](http://reactivex.io/documentation/operators/merge.html) - combine multiple Observables into one, allowing error-free Observables to continue before propagating errors
  ![rxjava_merge_delay_error]({{ basepath }}/assets/images/rxjava_merge_delay_error.png)
- [zip](http://reactivex.io/documentation/operators/zip.html) - combine sets of items emitted by two or more Observables together via a specified function and emit items based on the results of this function
  ![rxjava_zip]({{ basepath }}/assets/images/rxjava_zip.png)
- [combineLatest](http://reactivex.io/documentation/operators/combinelatest.html) - when an item is emitted by either of two Observables, combine the latest item emitted by each Observable via a specified function and emit items based on the results of this function
  ![rxjava_combine_lastest]({{ basepath }}/assets/images/rxjava_combine_lastest.png)
- [join and groupJoin](http://reactivex.io/documentation/operators/join.html) - combine the items emitted by two Observables whenever one item from one Observable falls within a window of duration specified by an item emitted by the other Observable  
  如果一个Observable发射了一条数据，只要在另一个Observable发射的数据定义的时间窗口内，就结合两个Observable发射的数据，然后发射结合后的数据。  
  目标Observable和源Observable发射的数据都有一个有效时间限制，比如目标发射了一条数据（a）有效期为3s，过了2s后，源发射了一条数据（b），因为2s<3s，目标的那条数据还在有效期，所以可以组合为ab；再过2s，源又发射了一条数据（c）,这时候一共过去了4s，目标的数据a已经过期，所以不能组合了…  
  ![rxjava_join]({{ basepath }}/assets/images/rxjava_join.png)  
  ![rxjava_group_join]({{ basepath }}/assets/images/rxjava_group_join.png)
- [switchOnNext](http://reactivex.io/documentation/operators/switch.html) - convert an Observable that emits Observables into a single Observable that emits the items emitted by the most-recently emitted of those Observables  
  将一个发射多个Observables的Observable转换成另一个单独的Observable，后者发射那些Observables最近发射的数据项。  
  Switch订阅一个发射多个Observables的Observable。它每次观察那些Observables中的一个，Switch返回的这个Observable取消订阅前一个发射数据的Observable，开始发射最近的Observable发射的数据。  
  注意：当原始Observable发射了一个新的Observable时（不是这个新的Observable发射了一条数据时），它将取消订阅之前的那个Observable。这意味着，在后来那个Observable产生之后，前一个Observable发射的数据将被丢弃（就像图例上的那个黄色圆圈一样）。  
  ![rxjava_switch]({{ basepath }}/assets/images/rxjava_switch.png)

组合操作例子：
```java
Observable.just(1, 2, 3)
          .startWith(0)
          .subscribe(new Consumer<Integer>() {
              @Override
              public void accept(Integer integer) throws Exception {
                  Log.e(TAG, "accept " + integer);
              }
          });
```

### 3.3 [条件与Boolean操作符](https://github.com/ReactiveX/RxJava/wiki/Conditional-and-Boolean-Operators)
条件操作符
- [amb](http://reactivex.io/documentation/operators/amb.html) — given two or more source Observables, emits all of the items from the first of these Observables to emit an item
  ![rxjava_amb]({{ basepath }}/assets/images/rxjava_amb.png)
- [defaultIfEmpty](http://reactivex.io/documentation/operators/defaultifempty.html) — emit items from the source Observable, or emit a default item if the source Observable completes after emitting no items
  ![rxjava_default_if_empty]({{ basepath }}/assets/images/rxjava_default_if_empty.png)
- [skipUntil](http://reactivex.io/documentation/operators/skipuntil.html) — discard items emitted by a source Observable until a second Observable emits an item, then emit the remainder of the source Observable's items
  ![rxjava_skip_until]({{ basepath }}/assets/images/rxjava_skip_until.png)
- [skipWhile](http://reactivex.io/documentation/operators/skipwhile.html) — discard items emitted by an Observable until a specified condition is false, then emit the remainder
  ![rxjava_skip_while]({{ basepath }}/assets/images/rxjava_skip_while.png)
- [takeUntil](http://reactivex.io/documentation/operators/takeuntil.html) — emits the items from the source Observable until a second Observable emits an item or issues a notification
  ![rxjava_take_until]({{ basepath }}/assets/images/rxjava_take_until.png)
- [takeWhile and takeWhileWithIndex](http://reactivex.io/documentation/operators/takewhile.html) — emit items emitted by an Observable as long as a specified condition is true, then skip the remainder
  ![rxjava_take_while]({{ basepath }}/assets/images/rxjava_take_while.png)

Boolean操作符
- [all](http://reactivex.io/documentation/operators/all.html) — determine whether all items emitted by an Observable meet some criteria
  ![rxjava_all]({{ basepath }}/assets/images/rxjava_all.png)
- [contains](http://reactivex.io/documentation/operators/contains.html) — determine whether an Observable emits a particular item or not
  ![rxjava_contain]({{ basepath }}/assets/images/rxjava_contain.png)
- [exists and isEmpty](http://reactivex.io/documentation/operators/contains.html) — determine whether an Observable emits any items or not
- [sequenceEqual](http://reactivex.io/documentation/operators/sequenceequal.html) — test the equality of the sequences emitted by two Observables
  ![rxjava_sequence_equal]({{ basepath }}/assets/images/rxjava_sequence_equal.png)
---
A Decision Tree of Observable Operators
This tree can help you find the ReactiveX Observable operator you’re looking for.

I want to create a new Observable
that emits a particular itemJust
that was returned from a function called at subscribe-timeStartthat was returned from an Action, Callable, Runnable, or something of that sort, called at subscribe-timeFromafter a specified delayTimer
that pulls its emissions from a particular Array, Iterable, or something like thatFromby retrieving it from a FutureStartthat obtains its sequence from a FutureFromthat emits a sequence of items repeatedlyRepeatfrom scratch, with custom logicCreatefor each observer that subscribesDeferthat emits a sequence of integersRange
at particular intervals of timeInterval
after a specified delayTimer
that completes without emitting itemsEmptythat does nothing at allNever
I want to create an Observable by combining other Observables
and emitting all of the items from all of the Observables in whatever order they are receivedMergeand emitting all of the items from all of the Observables, one Observable at a timeConcatby combining the items from two or more Observables sequentially to come up with new items to emit
whenever each of the Observables has emitted a new itemZipwhenever any of the Observables has emitted a new itemCombineLatestwhenever an item is emitted by one Observable in a window defined by an item emitted by anotherJoinby means of Pattern and Plan intermediariesAnd/Then/When
and emitting the items from only the most-recently emitted of those ObservablesSwitch
I want to emit the items from an Observable after transforming them
one at a time with a functionMapby emitting all of the items emitted by corresponding ObservablesFlatMap
one Observable at a time, in the order they are emittedConcatMap
based on all of the items that preceded themScanby attaching a timestamp to themTimestampinto an indicator of the amount of time that lapsed before the emission of the itemTimeInterval
I want to shift the items emitted by an Observable forward in time before reemitting themDelayI want to transform items and notifications from an Observable into items and reemit them
by wrapping them in Notification objectsMaterialize
which I can then unwrap again withDematerialize
I want to ignore all items emitted by an Observable and only pass along its completed/error notificationIgnoreElementsI want to mirror an Observable but prefix items to its sequenceStartWith
only if its sequence is emptyDefaultIfEmpty
I want to collect items from an Observable and reemit them as buffers of itemsBuffer
containing only the last items emittedTakeLastBuffer
I want to split one Observable into multiple ObservablesWindow
so that similar items end up on the same ObservableGroupBy
I want to retrieve a particular item emitted by an Observable:
the last item emitted before it completedLastthe sole item it emittedSinglethe first item it emittedFirst
I want to reemit only certain items from an Observable
by filtering out those that do not match some predicateFilterthat is, only the first itemFirstthat is, only the first itemsTakethat is, only the last itemLastthat is, only item nElementAtthat is, only those items after the first items
that is, after the first n itemsSkipthat is, until one of those items matches a predicateSkipWhilethat is, after an initial period of timeSkipthat is, after a second Observable emits an itemSkipUntil
that is, those items except the last items
that is, except the last n itemsSkipLastthat is, until one of those items matches a predicateTakeWhilethat is, except items emitted during a period of time before the source completesSkipLastthat is, except items emitted after a second Observable emits an itemTakeUntil
by sampling the Observable periodicallySampleby only emitting items that are not followed by other items within some durationDebounceby suppressing items that are duplicates of already-emitted itemsDistinct
if they immediately follow the item they are duplicates ofDistinctUntilChanged
by delaying my subscription to it for some time after it begins emitting itemsDelaySubscription
I want to reemit items from an Observable only on condition that it was the first of a collection of Observables to emit an itemAmbI want to evaluate the entire sequence of items emitted by an Observable
and emit a single boolean indicating if all of the items pass some testAlland emit a single boolean indicating if the Observable emitted any item (that passes some test)Containsand emit a single boolean indicating if the Observable emitted no itemsIsEmptyand emit a single boolean indicating if the sequence is identical to one emitted by a second ObservableSequenceEqualand emit the average of all of their valuesAverageand emit the sum of all of their valuesSumand emit a number indicating how many items were in the sequenceCountand emit the item with the maximum valueMaxand emit the item with the minimum valueMinby applying an aggregation function to each item in turn and emitting the resultScan
I want to convert the entire sequence of items emitted by an Observable into some other data structureToI want an operator to operate on a particular SchedulerSubscribeOn
when it notifies observersObserveOn
I want an Observable to invoke a particular action when certain events occurDoI want an Observable that will notify observers of an errorThrow
if a specified period of time elapses without it emitting an itemTimeout
I want an Observable to recover gracefully
from a timeout by switching to a backup ObservableTimeoutfrom an upstream error notificationCatch
by attempting to resubscribe to the upstream ObservableRetry
I want to create a resource that has the same lifespan as the ObservableUsingI want to subscribe to an Observable and receive a Future that blocks until the Observable completesStartI want an Observable that does not start emitting items to subscribers until askedPublish
and then only emits the last item in its sequencePublishLastand then emits the complete sequence, even to those who subscribe after the sequence has begunReplaybut I want it to go away once all of its subscribers unsubscribeRefCountand then I want to ask it to startConnect
See Also
Which Operator do I use? by Dennis Stoyanov (a similar decision tree, specific to RxJS operators)

---

- create
- just
- map
- zip
- contact
- flatMap
- contactMap
- distinct
- filter
- buffer
- timer
- interval
- doOnNext
- skip
- take
- Single
- debounce
- defer
- last
- merge
- reduce
- scan


#### Creating Observables
- create
- defer
- empty/never/throw
- from
- interval
- just
- range
- repeat
- start
- timer
