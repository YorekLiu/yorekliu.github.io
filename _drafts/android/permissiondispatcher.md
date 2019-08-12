---
title: "PermissionDispatcher源码解析"
excerpt: "基于注解的动态权限请求框架PermissionDispatcher源码解析"
categories:
  - Android
tags:
  - PermissionDispatcher
header:
  overlay_image: /assets/images/android/permissiondispatcher-overview.png
  overlay_filter: rgba(126, 202, 286, 0.6)
toc: true
toc_label: "目录"
# last_modified_at: 2019-06-20T22:15:50+08:00
---

基于[PermissionDispatcher](https://github.com/permissions-dispatcher/PermissionsDispatcher) v4.5.0 左右的最新master源码，节点为`332b4a1`。
{: .notice--info }

PermissionDispatcher是一个基于注解的动态权限请求框架。其主要工作原理就是在编译时获取指定注解的内容，然后生成辅助文件参与编译。本文将通过源码深入介绍PermissionDispatcher的原理。  
另外关于注解的一些介绍，在[注解的定义及解析](/android/annotation)一文中有详细的介绍。这是撰写那篇文章时，让我产生了写这篇文章的想法。

下面首先介绍一下PermissionDispatcher的模块关系图，以及各个模块的作用：

<figure style="width: 80%" class="align-center">
    <img src="/assets/images/android/permissiondispatcher-overview.png">
    <figcaption>PermissionDispatcher模块关系图</figcaption>
</figure>

- `sample-kotlin`  
  Kotlin版本的演示示例
- `sample`  
  Java版本的演示示例
- `library`  
  仅有一个`PermissionUtils`工具类，在生成的辅助文件中使用
- `processor`  
  自定义的注解处理器，在这里面会处理注解并生成辅助文件
- `annotation`  
  存放注解以及相关接口的位置
- `lint`  
  自定义的Lint
- `buildSrc`  
  自定义的Gradle插件




## 附录

MainActivity.kt in samplekotlin

```kotlin
package permissions.dispatcher.samplekotlin

import android.Manifest
import android.os.Bundle
import android.widget.Button
import android.widget.Toast
import androidx.annotation.StringRes
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import permissions.dispatcher.*
import permissions.dispatcher.samplekotlin.camera.CameraPreviewFragment
import permissions.dispatcher.samplekotlin.contacts.ContactsFragment

@RuntimePermissions
class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        val buttonCamera: Button = findViewById(R.id.button_camera)
        buttonCamera.setOnClickListener {
            showCameraWithPermissionCheck()
        }
        val buttonContacts: Button = findViewById(R.id.button_contacts)
        buttonContacts.setOnClickListener {
            showContactsWithPermissionCheck()
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        // NOTE: delegate the permission handling to generated method
        onRequestPermissionsResult(requestCode, grantResults)
    }

    @NeedsPermission(Manifest.permission.CAMERA)
    fun showCamera() {
        // NOTE: Perform action that requires the permission. If this is run by PermissionsDispatcher, the permission will have been granted
        supportFragmentManager.beginTransaction()
                .replace(R.id.sample_content_fragment, CameraPreviewFragment.newInstance())
                .addToBackStack("camera")
                .commitAllowingStateLoss()
    }

    @OnPermissionDenied(Manifest.permission.CAMERA)
    fun onCameraDenied() {
        // NOTE: Deal with a denied permission, e.g. by showing specific UI
        // or disabling certain functionality
        Toast.makeText(this, R.string.permission_camera_denied, Toast.LENGTH_SHORT).show()
    }

    @OnShowRationale(Manifest.permission.CAMERA)
    fun showRationaleForCamera(request: PermissionRequest) {
        // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
        // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
        showRationaleDialog(R.string.permission_camera_rationale, request)
    }

    @OnNeverAskAgain(Manifest.permission.CAMERA)
    fun onCameraNeverAskAgain() {
        Toast.makeText(this, R.string.permission_camera_never_ask_again, Toast.LENGTH_SHORT).show()
    }

    @NeedsPermission(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
    fun showContacts() {
        // NOTE: Perform action that requires the permission.
        // If this is run by PermissionsDispatcher, the permission will have been granted
        supportFragmentManager.beginTransaction()
                .replace(R.id.sample_content_fragment, ContactsFragment.newInstance())
                .addToBackStack("contacts")
                .commitAllowingStateLoss()
    }

    @OnPermissionDenied(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
    fun onContactsDenied() {
        // NOTE: Deal with a denied permission, e.g. by showing specific UI
        // or disabling certain functionality
        Toast.makeText(this, R.string.permission_contacts_denied, Toast.LENGTH_SHORT).show()
    }

    @OnShowRationale(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
    fun showRationaleForContacts(request: PermissionRequest) {
        // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
        // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
        showRationaleDialog(R.string.permission_contacts_rationale, request)
    }

    @OnNeverAskAgain(Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS)
    fun onContactsNeverAskAgain() {
        Toast.makeText(this, R.string.permission_contacts_never_ask_again, Toast.LENGTH_SHORT).show()
    }

    private fun showRationaleDialog(@StringRes messageResId: Int, request: PermissionRequest) {
        AlertDialog.Builder(this)
                .setPositiveButton(R.string.button_allow) { _, _ -> request.proceed() }
                .setNegativeButton(R.string.button_deny) { _, _ -> request.cancel() }
                .setCancelable(false)
                .setMessage(messageResId)
                .show()
    }
}
```

MainActivityPermissionDispatcher.kt in samplekotlin

```kotlin
// This file was generated by PermissionsDispatcher. Do not modify!
@file:JvmName("MainActivityPermissionsDispatcher")

package permissions.dispatcher.samplekotlin

import androidx.core.app.ActivityCompat
import java.lang.ref.WeakReference
import kotlin.Array
import kotlin.Int
import kotlin.IntArray
import kotlin.String
import permissions.dispatcher.PermissionRequest
import permissions.dispatcher.PermissionUtils

private const val REQUEST_SHOWCAMERA: Int = 0

private val PERMISSION_SHOWCAMERA: Array<String> = arrayOf("android.permission.CAMERA")

private const val REQUEST_SHOWCONTACTS: Int = 1

private val PERMISSION_SHOWCONTACTS: Array<String> = arrayOf("android.permission.READ_CONTACTS",
    "android.permission.WRITE_CONTACTS")

fun MainActivity.showCameraWithPermissionCheck() {
  if (PermissionUtils.hasSelfPermissions(this, *PERMISSION_SHOWCAMERA)) {
    showCamera()
  } else {
    if (PermissionUtils.shouldShowRequestPermissionRationale(this, *PERMISSION_SHOWCAMERA)) {
      showRationaleForCamera(MainActivityShowCameraPermissionRequest(this))
    } else {
      ActivityCompat.requestPermissions(this, PERMISSION_SHOWCAMERA, REQUEST_SHOWCAMERA)
    }
  }
}

fun MainActivity.showContactsWithPermissionCheck() {
  if (PermissionUtils.hasSelfPermissions(this, *PERMISSION_SHOWCONTACTS)) {
    showContacts()
  } else {
    if (PermissionUtils.shouldShowRequestPermissionRationale(this, *PERMISSION_SHOWCONTACTS)) {
      showRationaleForContacts(MainActivityShowContactsPermissionRequest(this))
    } else {
      ActivityCompat.requestPermissions(this, PERMISSION_SHOWCONTACTS, REQUEST_SHOWCONTACTS)
    }
  }
}

fun MainActivity.onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
  when (requestCode) {
    REQUEST_SHOWCAMERA ->
     {
      if (PermissionUtils.verifyPermissions(*grantResults)) {
        showCamera()
      } else {
        if (!PermissionUtils.shouldShowRequestPermissionRationale(this, *PERMISSION_SHOWCAMERA)) {
          onCameraNeverAskAgain()
        } else {
          onCameraDenied()
        }
      }
    }
    REQUEST_SHOWCONTACTS ->
     {
      if (PermissionUtils.verifyPermissions(*grantResults)) {
        showContacts()
      } else {
        if (!PermissionUtils.shouldShowRequestPermissionRationale(this, *PERMISSION_SHOWCONTACTS)) {
          onContactsNeverAskAgain()
        } else {
          onContactsDenied()
        }
      }
    }
  }
}

private class MainActivityShowCameraPermissionRequest(
  target: MainActivity
) : PermissionRequest {
  private val weakTarget: WeakReference<MainActivity> = WeakReference(target)

  override fun proceed() {
    val target = weakTarget.get() ?: return
    ActivityCompat.requestPermissions(target, PERMISSION_SHOWCAMERA, REQUEST_SHOWCAMERA)
  }

  override fun cancel() {
    val target = weakTarget.get() ?: return
    target.onCameraDenied()
  }
}

private class MainActivityShowContactsPermissionRequest(
  target: MainActivity
) : PermissionRequest {
  private val weakTarget: WeakReference<MainActivity> = WeakReference(target)

  override fun proceed() {
    val target = weakTarget.get() ?: return
    ActivityCompat.requestPermissions(target, PERMISSION_SHOWCONTACTS, REQUEST_SHOWCONTACTS)
  }

  override fun cancel() {
    val target = weakTarget.get() ?: return
    target.onContactsDenied()
  }
}
```

MainActivity.java in sample

```java
package permissions.dispatcher.sample;

import android.Manifest;
import android.content.DialogInterface;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.StringRes;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import permissions.dispatcher.NeedsPermission;
import permissions.dispatcher.OnNeverAskAgain;
import permissions.dispatcher.OnPermissionDenied;
import permissions.dispatcher.OnShowRationale;
import permissions.dispatcher.PermissionRequest;
import permissions.dispatcher.RuntimePermissions;
import permissions.dispatcher.sample.camera.CameraPreviewFragment;
import permissions.dispatcher.sample.contacts.ContactsFragment;

@RuntimePermissions
public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        findViewById(R.id.button_camera).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                MainActivityPermissionsDispatcher.showCameraWithPermissionCheck(MainActivity.this);
            }
        });
        findViewById(R.id.button_contacts).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                MainActivityPermissionsDispatcher.showContactsWithPermissionCheck(MainActivity.this);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        // NOTE: delegate the permission handling to generated method
        MainActivityPermissionsDispatcher.onRequestPermissionsResult(this, requestCode, grantResults);
    }

    @NeedsPermission(Manifest.permission.CAMERA)
    void showCamera() {
        // NOTE: Perform action that requires the permission. If this is run by PermissionsDispatcher, the permission will have been granted
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.sample_content_fragment, CameraPreviewFragment.newInstance())
                .addToBackStack("camera")
                .commitAllowingStateLoss();
    }

    @OnPermissionDenied(Manifest.permission.CAMERA)
    void onCameraDenied() {
        // NOTE: Deal with a denied permission, e.g. by showing specific UI
        // or disabling certain functionality
        Toast.makeText(this, R.string.permission_camera_denied, Toast.LENGTH_SHORT).show();
    }

    @OnShowRationale(Manifest.permission.CAMERA)
    void showRationaleForCamera(PermissionRequest request) {
        // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
        // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
        showRationaleDialog(R.string.permission_camera_rationale, request);
    }

    @OnNeverAskAgain(Manifest.permission.CAMERA)
    void onCameraNeverAskAgain() {
        Toast.makeText(this, R.string.permission_camera_never_ask_again, Toast.LENGTH_SHORT).show();
    }

    @NeedsPermission({Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS})
    void showContacts() {
        // NOTE: Perform action that requires the permission.
        // If this is run by PermissionsDispatcher, the permission will have been granted
        getSupportFragmentManager().beginTransaction()
                .replace(R.id.sample_content_fragment, ContactsFragment.newInstance())
                .addToBackStack("contacts")
                .commitAllowingStateLoss();
    }

    @OnPermissionDenied({Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS})
    void onContactsDenied() {
        // NOTE: Deal with a denied permission, e.g. by showing specific UI
        // or disabling certain functionality
        Toast.makeText(this, R.string.permission_contacts_denied, Toast.LENGTH_SHORT).show();
    }

    @OnShowRationale({Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS})
    void showRationaleForContact(PermissionRequest request) {
        // NOTE: Show a rationale to explain why the permission is needed, e.g. with a dialog.
        // Call proceed() or cancel() on the provided PermissionRequest to continue or abort
        showRationaleDialog(R.string.permission_contacts_rationale, request);
    }

    @OnNeverAskAgain({Manifest.permission.READ_CONTACTS, Manifest.permission.WRITE_CONTACTS})
    void onContactsNeverAskAgain() {
        Toast.makeText(this, R.string.permission_contacts_never_ask_again, Toast.LENGTH_SHORT).show();
    }

    private void showRationaleDialog(@StringRes int messageResId, final PermissionRequest request) {
        new AlertDialog.Builder(this)
                .setPositiveButton(R.string.button_allow, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(@NonNull DialogInterface dialog, int which) {
                        request.proceed();
                    }
                })
                .setNegativeButton(R.string.button_deny, new DialogInterface.OnClickListener() {
                    @Override
                    public void onClick(@NonNull DialogInterface dialog, int which) {
                        request.cancel();
                    }
                })
                .setCancelable(false)
                .setMessage(messageResId)
                .show();
    }
}
```

MainActivityPermissionsDispatcher.java in sample

```java
// This file was generated by PermissionsDispatcher. Do not modify!
package permissions.dispatcher.sample;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import java.lang.Override;
import java.lang.String;
import java.lang.ref.WeakReference;
import permissions.dispatcher.PermissionRequest;
import permissions.dispatcher.PermissionUtils;

final class MainActivityPermissionsDispatcher {
  private static final int REQUEST_SHOWCAMERA = 0;

  private static final String[] PERMISSION_SHOWCAMERA = new String[] {"android.permission.CAMERA"};

  private static final int REQUEST_SHOWCONTACTS = 1;

  private static final String[] PERMISSION_SHOWCONTACTS = new String[] {"android.permission.READ_CONTACTS","android.permission.WRITE_CONTACTS"};

  private MainActivityPermissionsDispatcher() {
  }

  static void showCameraWithPermissionCheck(@NonNull MainActivity target) {
    if (PermissionUtils.hasSelfPermissions(target, PERMISSION_SHOWCAMERA)) {
      target.showCamera();
    } else {
      if (PermissionUtils.shouldShowRequestPermissionRationale(target, PERMISSION_SHOWCAMERA)) {
        target.showRationaleForCamera(new MainActivityShowCameraPermissionRequest(target));
      } else {
        ActivityCompat.requestPermissions(target, PERMISSION_SHOWCAMERA, REQUEST_SHOWCAMERA);
      }
    }
  }

  static void showContactsWithPermissionCheck(@NonNull MainActivity target) {
    if (PermissionUtils.hasSelfPermissions(target, PERMISSION_SHOWCONTACTS)) {
      target.showContacts();
    } else {
      if (PermissionUtils.shouldShowRequestPermissionRationale(target, PERMISSION_SHOWCONTACTS)) {
        target.showRationaleForContact(new MainActivityShowContactsPermissionRequest(target));
      } else {
        ActivityCompat.requestPermissions(target, PERMISSION_SHOWCONTACTS, REQUEST_SHOWCONTACTS);
      }
    }
  }

  static void onRequestPermissionsResult(@NonNull MainActivity target, int requestCode,
      int[] grantResults) {
    switch (requestCode) {
      case REQUEST_SHOWCAMERA:
      if (PermissionUtils.verifyPermissions(grantResults)) {
        target.showCamera();
      } else {
        if (!PermissionUtils.shouldShowRequestPermissionRationale(target, PERMISSION_SHOWCAMERA)) {
          target.onCameraNeverAskAgain();
        } else {
          target.onCameraDenied();
        }
      }
      break;
      case REQUEST_SHOWCONTACTS:
      if (PermissionUtils.verifyPermissions(grantResults)) {
        target.showContacts();
      } else {
        if (!PermissionUtils.shouldShowRequestPermissionRationale(target, PERMISSION_SHOWCONTACTS)) {
          target.onContactsNeverAskAgain();
        } else {
          target.onContactsDenied();
        }
      }
      break;
      default:
      break;
    }
  }

  private static final class MainActivityShowCameraPermissionRequest implements PermissionRequest {
    private final WeakReference<MainActivity> weakTarget;

    private MainActivityShowCameraPermissionRequest(@NonNull MainActivity target) {
      this.weakTarget = new WeakReference<MainActivity>(target);
    }

    @Override
    public void proceed() {
      MainActivity target = weakTarget.get();
      if (target == null) return;
      ActivityCompat.requestPermissions(target, PERMISSION_SHOWCAMERA, REQUEST_SHOWCAMERA);
    }

    @Override
    public void cancel() {
      MainActivity target = weakTarget.get();
      if (target == null) return;
      target.onCameraDenied();
    }
  }

  private static final class MainActivityShowContactsPermissionRequest implements PermissionRequest {
    private final WeakReference<MainActivity> weakTarget;

    private MainActivityShowContactsPermissionRequest(@NonNull MainActivity target) {
      this.weakTarget = new WeakReference<MainActivity>(target);
    }

    @Override
    public void proceed() {
      MainActivity target = weakTarget.get();
      if (target == null) return;
      ActivityCompat.requestPermissions(target, PERMISSION_SHOWCONTACTS, REQUEST_SHOWCONTACTS);
    }

    @Override
    public void cancel() {
      MainActivity target = weakTarget.get();
      if (target == null) return;
      target.onContactsDenied();
    }
  }
}
```