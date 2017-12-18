var idx = lunr(function () {
  this.field('title', {boost: 10})
  this.field('excerpt')
  this.field('categories')
  this.field('tags')
  this.ref('id')
});



  
  
    idx.add({
      title: "Android四大组件(1)",
      excerpt: "Android四大组件分别是Activity、Service、ContentProvider以及BroadcastReceiver。 其中，Activity是使用最频繁的一个组件，可以翻译为界面。当然，我们常见的界面除了Activity，还有Window(这里指悬浮窗，类似于360的悬浮球)、Dialog以及Toast。Android中所有的视图都是通过Window来呈现的。 关于Fragment，可以查看Android四大组件(4)。两者一起看能更好的了解彼此。 本章的主要内容有：Activity生命周期、启动模式、IntentFilter匹配规则。 英语好的可以直接看google官方文档，讲的更多更细。 1 Activity的生命周期 Activity的生命周期分为两个部分：正常情况、异常情况。 所谓正常情况就是指在用户的参与下经历的生命周期的改变；而异常情况是指Activity因RAM不足被LMK杀死或者由于的Configuration(比如横竖屏切换、语言改变等)改变导致Activity销毁重构。 1.1 正常情况下Activity的生命周期 如图，是正常情况下Activity所经历的生命周期。 onCreate：当Activity第一次创建的时候调用。在这里，我们做一些初始化工作：加载布局、初始化Activity所需要的数据等。 onRestart：Activity重新启动。当Activity从不可见重新变成可见状态时，此方法会被调用。 onStart：表示Activity正在启动，当Activity正在变成可见状态时会被调用。 onResume：表示Activity已经可见了，且出现在前台可与用户进行交互。 onPause：Activity正在停止。此时可以提交未保存的数据、停止动画或其他可能消耗CPU资源的操作。在此方法中不能执行耗时操作，因为下一个Activity不会调用onResume直到该方法执行完。 onStop：Activity即将停止，当Activity不在可见时调用，因为另一个Activity已经调用了onResume，并且覆盖了这个Activity。 onDestroy：Activity即将被销毁。 在Activity的生命周期中有三个关键的循环：...",
      categories: ["Android SDK"],
      tags: ["Activity"],
      id: 0
    });
    
  
    idx.add({
      title: "Android四大组件(2)",
      excerpt: "本章的主要角色是Service。 Service是一种能够在后台执行长期运行操作的组件，它并没有UI界面。所有应用都可以开启一个Service，甚至当用户切换其他应用时，它也能继续在后台运行。另外，别的组件可以跟一个Service绑定，甚至可以执行IPC操作。比如，Service可以处理网络事务、播放音乐、处理文件I/O，或者与一个content provider交互，这一切都在后台运行。 注意：Service运行在宿主进程的主线程中。Service并不会创建自己的线程，在没有特别申明的情况下也不会运行在分离的进程中。如果你的Service打算执行消耗CPU的工作或者阻塞的操作，比如播放MP3或网络操作等，你应该在Service内创建新的线程。这能减少ANR的风险，主线程也能专心与处于UI事务。 1 Service的类型 现在有三种类型的Service，主要说后面两种。 Scheduled Google强烈推荐在Android 5.0 (API level 21)或以上上面，使用JobScheduler来启动Service，系统会在合适的时间优雅的按计划执行这些任务。 Started 启动状态 当一个应用组件调用了startService时，Service会处于启动状态。当Service启动后，它能够无期限的运行在后台，甚至开启该Service的组件已经销毁了。通常，处于启动状态的Service执行单一的操作，而且不返回操作结果给调用者。比如，从网络下载文件。当任务完成后，Service应该停止它本身。可以在Service内部调用stopSelf()或者其他组件调用stopService()来终止Service。 Bound 绑定状态 当一个应用组件调用了bindService时，Service会处于绑定状态。处于绑定状态的Service提供了一个允许其他组件与该Service交互的C/S接口，这些交互可能是发送请求，接收数据，甚至执行IPC操作。只要其他应用组件绑定了他，它就会开始运行。多个组件能绑定到一个Service实例上，当它们都解绑时，此Service实例就会销毁。 启动状态与绑定状态不是互斥的。你能绑定一个以startService()启动的Service。比如，你可以通过startService()启动一个Service播放音乐。然后，用户可能想切歌或者获取当前歌曲的信息，此时Activity可以通过bindService()绑定到该Service。这种情况下，事实上直到客户端解绑，stopService()或stopSelf()才能停止Service。...",
      categories: ["Android SDK"],
      tags: ["Service"],
      id: 1
    });
    
  
    idx.add({
      title: "Android四大组件(3)",
      excerpt: "本章的主要内容是Broadcasts Broadcasts是一种通讯组件，Android应用程序可以发送或接收来自Android系统和其他Android应用程序的广播消息，类似于观察者设计模式。当感兴趣的事件发生时，这些广播被发送。例如，当各种系统事件（例如系统启动或设备开始充电）发生时，Android系统会发送广播。应用程序还可以发送自定义广播，例如，通知其他应用程序可能感兴趣的内容（例如，一些新数据已被下载）。 1 系统广播 系统广播的action的列表，可以在SDK中找到，目录是platforms/android-25/data/broadcast_actions.txt 1.1 系统广播的变更 Android 7.0及以上平台不可以发送以下系统广播，该项优化影响所有的应用，不仅仅是目标为Android 7.0的应用： ACTION_NEW_PICTURE ACTION_NEW_VIDEO 应用目标为Android 7.0 (API level 24)及更高平台必须动态注册以下广播，静态注册无效： CONNECTIVITY_ACTION 2 广播的注册...",
      categories: ["Android SDK"],
      tags: ["Broadcasts"],
      id: 2
    });
    
  
    idx.add({
      title: "Android四大组件(4)",
      excerpt: "本章的主要内容是Content Providers以及Fragment ContentProvider可以帮助应用程序管理自身存储的数据，并提供了一种与其他应用程序共享数据的方式。它们封装数据，并提供数据安全的机制。ContentProvider是代码运行的进程与另一个进程连接数据的标准接口。实现ContentProvider有很多优点。更重要的是，你可以配置一个ContentProvider，以允许其他应用程序能够安全地访问和修改应用程序数据，如下图所示。 系统预置了很多ContentProvider，比如MediaProvider、CalendarProvider、ContactsProvider等等，要跨进程访问这些信息，只需要通过ContentProvider的query、update、insert和delete方法即可。而创建一个ContentProvider也很简单，只需要实现onCreate、query、update、insert、delete和getType。onCreate可以做一些初始化工作，getType用来返回一个URI请求所对应的mimeType，如果应用不关注这个，可以返回null或者”*/*“。剩下的四个方法对应CRUD操作。 根据Binder的工作原理，除了onCreate由系统回调运行在主线程中，其他五个方法运行在Binder线程池中。 1 自定义ContentProvider ContentProvider的注册 ```xml  &lt;provider android:authorities=”list” android:directBootAware=[“true” | “false”] android:enabled=[“true” | “false”] android:exported=[“true” | “false”]...",
      categories: ["Android SDK"],
      tags: ["Content Providers","Fragment"],
      id: 3
    });
    
  


console.log( jQuery.type(idx) );

var store = [
  
    
    
    
      
      {
        "title": "Android四大组件(1)",
        "url": "http://localhost:4000/android%20sdk/Android%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6(1)/",
        "excerpt": "Android四大组件分别是Activity、Service、ContentProvider以及BroadcastReceiver。 其中，Activity是使用最频繁的一个组件，可以翻译为界面。当然，我们常见的界面除了Activity，还有Window(这里指悬浮窗，类似于360的悬浮球)、Dialog以及Toast。Android中所有的视图都是通过Window来呈现的。 关于Fragment，可以查看Android四大组件(4)。两者一起看能更好的了解彼此。 本章的主要内容有：Activity生命周期、启动模式、IntentFilter匹配规则。 英语好的可以直接看google官方文档，讲的更多更细。 1 Activity的生命周期 Activity的生命周期分为两个部分：正常情况、异常情况。 所谓正常情况就是指在用户的参与下经历的生命周期的改变；而异常情况是指Activity因RAM不足被LMK杀死或者由于的Configuration(比如横竖屏切换、语言改变等)改变导致Activity销毁重构。 1.1 正常情况下Activity的生命周期 如图，是正常情况下Activity所经历的生命周期。 onCreate：当Activity第一次创建的时候调用。在这里，我们做一些初始化工作：加载布局、初始化Activity所需要的数据等。 onRestart：Activity重新启动。当Activity从不可见重新变成可见状态时，此方法会被调用。 onStart：表示Activity正在启动，当Activity正在变成可见状态时会被调用。 onResume：表示Activity已经可见了，且出现在前台可与用户进行交互。 onPause：Activity正在停止。此时可以提交未保存的数据、停止动画或其他可能消耗CPU资源的操作。在此方法中不能执行耗时操作，因为下一个Activity不会调用onResume直到该方法执行完。 onStop：Activity即将停止，当Activity不在可见时调用，因为另一个Activity已经调用了onResume，并且覆盖了这个Activity。 onDestroy：Activity即将被销毁。 在Activity的生命周期中有三个关键的循环：...",
        "teaser":
          
            null
          
      },
    
      
      {
        "title": "Android四大组件(2)",
        "url": "http://localhost:4000/android%20sdk/Android%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6(2)/",
        "excerpt": "本章的主要角色是Service。 Service是一种能够在后台执行长期运行操作的组件，它并没有UI界面。所有应用都可以开启一个Service，甚至当用户切换其他应用时，它也能继续在后台运行。另外，别的组件可以跟一个Service绑定，甚至可以执行IPC操作。比如，Service可以处理网络事务、播放音乐、处理文件I/O，或者与一个content provider交互，这一切都在后台运行。 注意：Service运行在宿主进程的主线程中。Service并不会创建自己的线程，在没有特别申明的情况下也不会运行在分离的进程中。如果你的Service打算执行消耗CPU的工作或者阻塞的操作，比如播放MP3或网络操作等，你应该在Service内创建新的线程。这能减少ANR的风险，主线程也能专心与处于UI事务。 1 Service的类型 现在有三种类型的Service，主要说后面两种。 Scheduled Google强烈推荐在Android 5.0 (API level 21)或以上上面，使用JobScheduler来启动Service，系统会在合适的时间优雅的按计划执行这些任务。 Started 启动状态 当一个应用组件调用了startService时，Service会处于启动状态。当Service启动后，它能够无期限的运行在后台，甚至开启该Service的组件已经销毁了。通常，处于启动状态的Service执行单一的操作，而且不返回操作结果给调用者。比如，从网络下载文件。当任务完成后，Service应该停止它本身。可以在Service内部调用stopSelf()或者其他组件调用stopService()来终止Service。 Bound 绑定状态 当一个应用组件调用了bindService时，Service会处于绑定状态。处于绑定状态的Service提供了一个允许其他组件与该Service交互的C/S接口，这些交互可能是发送请求，接收数据，甚至执行IPC操作。只要其他应用组件绑定了他，它就会开始运行。多个组件能绑定到一个Service实例上，当它们都解绑时，此Service实例就会销毁。 启动状态与绑定状态不是互斥的。你能绑定一个以startService()启动的Service。比如，你可以通过startService()启动一个Service播放音乐。然后，用户可能想切歌或者获取当前歌曲的信息，此时Activity可以通过bindService()绑定到该Service。这种情况下，事实上直到客户端解绑，stopService()或stopSelf()才能停止Service。...",
        "teaser":
          
            null
          
      },
    
      
      {
        "title": "Android四大组件(3)",
        "url": "http://localhost:4000/android%20sdk/Android%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6(3)/",
        "excerpt": "本章的主要内容是Broadcasts Broadcasts是一种通讯组件，Android应用程序可以发送或接收来自Android系统和其他Android应用程序的广播消息，类似于观察者设计模式。当感兴趣的事件发生时，这些广播被发送。例如，当各种系统事件（例如系统启动或设备开始充电）发生时，Android系统会发送广播。应用程序还可以发送自定义广播，例如，通知其他应用程序可能感兴趣的内容（例如，一些新数据已被下载）。 1 系统广播 系统广播的action的列表，可以在SDK中找到，目录是platforms/android-25/data/broadcast_actions.txt 1.1 系统广播的变更 Android 7.0及以上平台不可以发送以下系统广播，该项优化影响所有的应用，不仅仅是目标为Android 7.0的应用： ACTION_NEW_PICTURE ACTION_NEW_VIDEO 应用目标为Android 7.0 (API level 24)及更高平台必须动态注册以下广播，静态注册无效： CONNECTIVITY_ACTION 2 广播的注册...",
        "teaser":
          
            null
          
      },
    
      
      {
        "title": "Android四大组件(4)",
        "url": "http://localhost:4000/android%20sdk/Android%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6(4)/",
        "excerpt": "本章的主要内容是Content Providers以及Fragment ContentProvider可以帮助应用程序管理自身存储的数据，并提供了一种与其他应用程序共享数据的方式。它们封装数据，并提供数据安全的机制。ContentProvider是代码运行的进程与另一个进程连接数据的标准接口。实现ContentProvider有很多优点。更重要的是，你可以配置一个ContentProvider，以允许其他应用程序能够安全地访问和修改应用程序数据，如下图所示。 系统预置了很多ContentProvider，比如MediaProvider、CalendarProvider、ContactsProvider等等，要跨进程访问这些信息，只需要通过ContentProvider的query、update、insert和delete方法即可。而创建一个ContentProvider也很简单，只需要实现onCreate、query、update、insert、delete和getType。onCreate可以做一些初始化工作，getType用来返回一个URI请求所对应的mimeType，如果应用不关注这个，可以返回null或者”*/*“。剩下的四个方法对应CRUD操作。 根据Binder的工作原理，除了onCreate由系统回调运行在主线程中，其他五个方法运行在Binder线程池中。 1 自定义ContentProvider ContentProvider的注册 ```xml  &lt;provider android:authorities=”list” android:directBootAware=[“true” | “false”] android:enabled=[“true” | “false”] android:exported=[“true” | “false”]...",
        "teaser":
          
            null
          
      }
    
  ]

$(document).ready(function() {
  $('input#search').on('keyup', function () {
    var resultdiv = $('#results');
    var query = $(this).val();
    var result = idx.search(query);
    resultdiv.empty();
    resultdiv.prepend('<p class="results__found">'+result.length+' Result(s) found</p>');
    for (var item in result) {
      var ref = result[item].ref;
      if(store[ref].teaser){
        var searchitem =
          '<div class="list__item">'+
            '<article class="archive__item" itemscope itemtype="http://schema.org/CreativeWork">'+
              '<h2 class="archive__item-title" itemprop="headline">'+
                '<a href="'+store[ref].url+'" rel="permalink">'+store[ref].title+'</a>'+
              '</h2>'+
              '<div class="archive__item-teaser">'+
                '<img src="'+store[ref].teaser+'" alt="">'+
              '</div>'+
              '<p class="archive__item-excerpt" itemprop="description">'+store[ref].excerpt+'</p>'+
            '</article>'+
          '</div>';
      }
      else{
    	  var searchitem =
          '<div class="list__item">'+
            '<article class="archive__item" itemscope itemtype="http://schema.org/CreativeWork">'+
              '<h2 class="archive__item-title" itemprop="headline">'+
                '<a href="'+store[ref].url+'" rel="permalink">'+store[ref].title+'</a>'+
              '</h2>'+
              '<p class="archive__item-excerpt" itemprop="description">'+store[ref].excerpt+'</p>'+
            '</article>'+
          '</div>';
      }
      resultdiv.append(searchitem);
    }
  });
});
