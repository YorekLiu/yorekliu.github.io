---
title: "Android暂停酷狗、网易云音乐等音乐播放器的播放"
---

在某些时候，我们想暂停其他第三方音乐播放器(比如Google Play Music、网易云音乐等等)的播放，完成这些事情还要恢复。

我们可以使用AudioManager的API来完成
```java
//AudioManager.java
public int requestAudioFocus(AudioManager.OnAudioFocusChangeListener l, int streamType, int durationHint)  // 停止其他音乐的播放
public int abandonAudioFocus(AudioManager.OnAudioFocusChangeListener l)		// 恢复播放
```
关于参数的解释：[Android中的Audio播放：竞争Audio之Audio Focus的应用](http://www.linuxidc.com/Linux/2012-04/57902.htm)

举个例子，在Activity进入前台时暂停，进入后台时恢复：
```java
public class AudioPauseActivity extends AppCompatActivity {

    private AudioManager mAudioManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_audio_pause);

        mAudioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
    }

    @Override
    protected void onResume() {
        super.onResume();
        mAudioManager.requestAudioFocus(null, AudioManager.STREAM_RING, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT);
    }

    @Override
    protected void onPause() {
        super.onPause();
        mAudioManager.abandonAudioFocus(null);
    }
}
```

在Android 7.0上对Google Play Music、网易云音乐、酷狗实测有效。
