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
    
  


console.log( jQuery.type(idx) );

var store = [
  
    
    
    
      
      {
        "title": "Android四大组件(1)",
        "url": "http://localhost:4000/android%20sdk/Android%E5%9B%9B%E5%A4%A7%E7%BB%84%E4%BB%B6(1)/",
        "excerpt": "Android四大组件分别是Activity、Service、ContentProvider以及BroadcastReceiver。 其中，Activity是使用最频繁的一个组件，可以翻译为界面。当然，我们常见的界面除了Activity，还有Window(这里指悬浮窗，类似于360的悬浮球)、Dialog以及Toast。Android中所有的视图都是通过Window来呈现的。 关于Fragment，可以查看Android四大组件(4)。两者一起看能更好的了解彼此。 本章的主要内容有：Activity生命周期、启动模式、IntentFilter匹配规则。 英语好的可以直接看google官方文档，讲的更多更细。 1 Activity的生命周期 Activity的生命周期分为两个部分：正常情况、异常情况。 所谓正常情况就是指在用户的参与下经历的生命周期的改变；而异常情况是指Activity因RAM不足被LMK杀死或者由于的Configuration(比如横竖屏切换、语言改变等)改变导致Activity销毁重构。 1.1 正常情况下Activity的生命周期 如图，是正常情况下Activity所经历的生命周期。 onCreate：当Activity第一次创建的时候调用。在这里，我们做一些初始化工作：加载布局、初始化Activity所需要的数据等。 onRestart：Activity重新启动。当Activity从不可见重新变成可见状态时，此方法会被调用。 onStart：表示Activity正在启动，当Activity正在变成可见状态时会被调用。 onResume：表示Activity已经可见了，且出现在前台可与用户进行交互。 onPause：Activity正在停止。此时可以提交未保存的数据、停止动画或其他可能消耗CPU资源的操作。在此方法中不能执行耗时操作，因为下一个Activity不会调用onResume直到该方法执行完。 onStop：Activity即将停止，当Activity不在可见时调用，因为另一个Activity已经调用了onResume，并且覆盖了这个Activity。 onDestroy：Activity即将被销毁。 在Activity的生命周期中有三个关键的循环：...",
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
