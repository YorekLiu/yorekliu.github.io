---
title: "Android图片选择器"
---

1.辅助的权限管理类

```java
/**
 * 权限管理类
 */
public class PermissionManager {
    private static final String TAG = "PermissionManager";
    private static final int APP_REQUEST_CODE_ASK_LAUNCH_PERMISSIONS = 100;
    private final Fragment mFragment;
    private List<String> mAllPermissionList = new ArrayList<String>();

    public PermissionManager(Fragment fragment) {
        mFragment = fragment;
        initAllPermissionList();
    }

    private void initAllPermissionList() {
        mAllPermissionList.add(Manifest.permission.READ_EXTERNAL_STORAGE);
        mAllPermissionList.add(Manifest.permission.WRITE_EXTERNAL_STORAGE);
        mAllPermissionList.add(Manifest.permission.CAMERA);
    }

    private List<String> getNeedCheckPermissionList(List<String> permissionList) {
        // all needed permissions, may be on or off
        if (permissionList.size() <= 0) {
            return permissionList;
        }
        List<String> needCheckPermissionsList = new ArrayList<String>();
        for (String permission : permissionList) {
            if (ContextCompat.checkSelfPermission(mFragment.getContext(), permission)
                    != PackageManager.PERMISSION_GRANTED) {
                Log.i(TAG, "getNeedCheckPermissionList() permission ="
                        + permission);
                needCheckPermissionsList.add(permission);
            }
        }
        Log.i(TAG, "getNeedCheckPermissionList() listSize ="
                + needCheckPermissionsList.size());
        return needCheckPermissionsList;
    }

    public boolean checkAllPermissions() {
        List<String> needCheckPermissionsList = getNeedCheckPermissionList(mAllPermissionList);
        if (needCheckPermissionsList.size() > 0) {
            return false;
        }
        Log.i(TAG, "CheckAppPermissions(), all on");
        return true;
    }

    public boolean requestAllPermissions() {
        List<String> needCheckPermissionsList = getNeedCheckPermissionList(mAllPermissionList);
        if (needCheckPermissionsList.size() > 0) {
            // should show dialog
            Log.i(TAG, "requestAllPermissions(), user check");
            mFragment.requestPermissions(
                    needCheckPermissionsList.toArray(new String[needCheckPermissionsList.size()]),
                    APP_REQUEST_CODE_ASK_LAUNCH_PERMISSIONS);
            return false;
        }
        Log.i(TAG, "requestAllPermissions(), all on");
        return true;
    }

    public int getAllPermissionRequestCode() {
        return APP_REQUEST_CODE_ASK_LAUNCH_PERMISSIONS;
    }

    public boolean isAllPermissionsResultReady(
            String permissions[], int[] grantResults) {
        for (int i = 0; i < grantResults.length; i++) {
            if (grantResults[i] != PackageManager.PERMISSION_GRANTED) {
                return false;
            }
        }

        return true;
    }
}
```

2.将uri解析成文件路径的工具类

```java
/**
 * Created by fuh on 2017/5/4.
 * Email：unableApe@gmail.com
 */

public class UriUtils {
    /**
     * 根据Uri的不同Scheme解析出在本机的路径
     * @param context
     * @param uri
     * @return Uri的真实路径
     */
    @TargetApi(19)
    public static String formatUri(Context context, Uri uri) {
        final boolean isKitKat = Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT;
        // DocumentProvider
        if (isKitKat && DocumentsContract.isDocumentUri(context, uri)) {
            // ExternalStorageProvider
            if (isExternalStorageDocument(uri)) {
                final String docId = DocumentsContract.getDocumentId(uri);
                final String[] split = docId.split(":");
                final String type = split[0];

                if ("primary".equalsIgnoreCase(type)) {
                    return Environment.getExternalStorageDirectory() + "/"
                            + split[1];
                }

                // TODO handle non-primary volumes
            }
            // DownloadsProvider
            else if (isDownloadsDocument(uri)) {
                final String id = DocumentsContract.getDocumentId(uri);
                final Uri contentUri = ContentUris.withAppendedId(
                        Uri.parse("content://downloads/public_downloads"),
                        Long.valueOf(id));

                return getDataColumn(context, contentUri, null, null);
            }
            // MediaProvider
            else if (isMediaDocument(uri)) {
                final String docId = DocumentsContract.getDocumentId(uri);
                final String[] split = docId.split(":");
                final String type = split[0];

                Uri contentUri = null;
                if ("image".equals(type)) {
                    contentUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                } else if ("video".equals(type)) {
                    contentUri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI;
                } else if ("audio".equals(type)) {
                    contentUri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                }

                final String selection = "_id=?";
                final String[] selectionArgs = new String[]{split[1]};

                return getDataColumn(context, contentUri, selection,
                        selectionArgs);
            }
        }
        // MediaStore (and general)
        else if ("content".equalsIgnoreCase(uri.getScheme())) {

            // Return the remote address
            if (isGooglePhotosUri(uri))
                return uri.getLastPathSegment();

            return getDataColumn(context, uri, null, null);
        }
        // File
        else if ("file".equalsIgnoreCase(uri.getScheme())) {
            return uri.getPath();
        }

        return null;
    }

    public static String getDataColumn(Context context, Uri uri, String selection,
                                       String[] selectionArgs) {

        Cursor cursor = null;
        final String column = "_data";
        final String[] projection = {column};

        try {
            cursor = context.getContentResolver().query(uri, projection,
                    selection, selectionArgs, null);
            if (cursor != null && cursor.moveToFirst()) {
                final int index = cursor.getColumnIndexOrThrow(column);
                return cursor.getString(index);
            }
        } finally {
            if (cursor != null)
                cursor.close();
        }
        return null;
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is ExternalStorageProvider.
     */
    public static boolean isExternalStorageDocument(Uri uri) {
        return "com.android.externalstorage.documents".equals(uri
                .getAuthority());
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is DownloadsProvider.
     */
    public static boolean isDownloadsDocument(Uri uri) {
        return "com.android.providers.downloads.documents".equals(uri
                .getAuthority());
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is MediaProvider.
     */
    public static boolean isMediaDocument(Uri uri) {
        return "com.android.providers.media.documents".equals(uri
                .getAuthority());
    }

    /**
     * @param uri The Uri to check.
     * @return Whether the Uri authority is Google Photos.
     */
    public static boolean isGooglePhotosUri(Uri uri) {
        return "com.google.android.apps.photos.content".equals(uri
                .getAuthority());
    }
}
```

3.照片选择器Fragment类(没有UI的Fragment，只是为了好处理权限问题)

```java
/**
 * 从相册或相机选择头像
 * @author yorek
 * @date 16/01/2018
 */
public class PhotoChooseFragment extends Fragment {

    public static final String TAG = "PhotoChooseFragment";

    private PermissionManager mPermissionManager;
    private Boolean isOpenCamera;

    public interface OnPhotoChooseListener {
        void onPhotoChooseSuccess(File cropFile);
    }
    private OnPhotoChooseListener mPhotoChooseListener;

    public void setPhotoChooseListener(OnPhotoChooseListener listener) {
        mPhotoChooseListener = listener;
    }

    @Override
    public void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        mPermissionManager = new PermissionManager(this);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        if (mPermissionManager.getAllPermissionRequestCode() == requestCode) {
            if (!mPermissionManager.isAllPermissionsResultReady(permissions, grantResults)) {
                mPermissionManager.requestAllPermissions();
            } else {
                if (isOpenCamera == null) {
                    super.onRequestPermissionsResult(requestCode, permissions, grantResults);
                }
                if (isOpenCamera) {
                    openCamera();
                } else {
                    openGallery();
                }
            }
        }
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
    }

    private static final int REQUEST_OPEN_CAMERA = 0x00a1;
    private static final int REQUEST_OPEN_GALLERY = 0x00a2;
    private static final int REQUEST_CROP_PHOTO = 0x00a3;

    private Uri cameraPhotoUri;

    public void openCamera() {
        if (!mPermissionManager.checkAllPermissions()) {
            isOpenCamera = true;
            mPermissionManager.requestAllPermissions();
            return;
        }
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        File cameraPhotoFile;
        try {
            cameraPhotoFile = createPictureFile();
        } catch (Exception e) {
            e.printStackTrace();
            ToastUtils.showLongToast("文件创建失败：" + e.getMessage());
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            cameraPhotoUri = Uri.fromFile(cameraPhotoFile);
        } else {
            cameraPhotoUri = FileProvider.getUriForFile(getContext(), Constants.FILE_CONTENT_FILEPROVIDER, cameraPhotoFile);
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        }
        intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
        startActivityForResult(intent, REQUEST_OPEN_CAMERA);
    }

    public void openGallery() {
        if (!mPermissionManager.checkAllPermissions()) {
            isOpenCamera = false;
            mPermissionManager.requestAllPermissions();
            return;
        }
        Intent intent = new Intent();
        intent.setAction(Intent.ACTION_PICK);
        intent.setType("image/*");
        startActivityForResult(intent, REQUEST_OPEN_GALLERY);
    }

    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != Activity.RESULT_OK) {
            return;
        }
        switch (requestCode) {
            case REQUEST_OPEN_CAMERA:
                cropPhoto(cameraPhotoUri);
                break;
            case REQUEST_OPEN_GALLERY:
                if (data != null) {
                    Uri galleryPhotoUri = data.getData();
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        String galleryPhotoPath = UriUtils.formatUri(getContext(), galleryPhotoUri);
                        galleryPhotoUri = FileProvider.getUriForFile(getContext(), Constants.FILE_CONTENT_FILEPROVIDER, new File(galleryPhotoPath));
                    }
                    cropPhoto(galleryPhotoUri);
                }
                break;
            case REQUEST_CROP_PHOTO:
                if (mPhotoChooseListener != null) {
                    mPhotoChooseListener.onPhotoChooseSuccess(cropPhotoFile);
                }
                getContext().revokeUriPermission(cropPhotoUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                break;
            default:
        }
    }

    private Uri cropPhotoUri;
    private File cropPhotoFile;
    public void cropPhoto(Uri uri) {
        Intent intent = new Intent("com.android.camera.action.CROP");
        cropPhotoFile = null;
        try {
            cropPhotoFile = createCropPictureFile();
        } catch (Exception e) {
            e.printStackTrace();
            ToastUtils.showLongToast("文件创建失败：" + e.getMessage());
            return;
        }

        //7.0 安全机制下不允许保存裁剪后的图片
        //所以仅仅将File Uri传入MediaStore.EXTRA_OUTPUT来保存裁剪后的图像
        cropPhotoUri = Uri.fromFile(cropPhotoFile);

        intent.setDataAndType(uri, "image/*");
        intent.putExtra("crop", true);
        intent.putExtra("aspectX", 1);
        intent.putExtra("aspectY", 1);
        intent.putExtra("outputX", 300);
        intent.putExtra("outputY", 300);
        intent.putExtra("return-data", false);
        intent.putExtra(MediaStore.EXTRA_OUTPUT, cropPhotoUri);
        intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        startActivityForResult(intent, REQUEST_CROP_PHOTO);
    }

    private File createPictureFile() throws Exception {
        String pictureFileName = String.format(Locale.getDefault(), "Picture_%s", new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date()));
        File pictureDirName = getAvatarFile(getContext());
        if (!pictureDirName.exists()) {
            pictureDirName.mkdirs();
        }

        return File.createTempFile(
                pictureFileName,         /* prefix */
                ".jpg",             /* suffix */
                pictureDirName       /* directory */
        );
    }

    private File createCropPictureFile() throws Exception {
        String cropPictureFileName = String.format(Locale.getDefault(), "Crop_%s", new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date()));
        File cropPictureDirName = getAvatarFile(getContext());
        if (!cropPictureDirName.exists()) {
            cropPictureDirName.mkdirs();
        }

        return File.createTempFile(
                cropPictureFileName,         /* prefix */
                ".jpg",             /* suffix */
                cropPictureDirName      /* directory */
        );
    }

    public static File getAvatarFile(Context context) {
        return new File(context.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "avatar");
    }
}
```

4.怎么使用

```java
class MineFragment : BaseFragment(),
    PhotoChooseFragment.OnPhotoChooseListener {

    private var mPhotoChooseFragment: PhotoChooseFragment? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // 初始化PhotoChooseFragment
        mPhotoChooseFragment = childFragmentManager.findFragmentByTag(PhotoChooseFragment.TAG) as? PhotoChooseFragment
        if (mPhotoChooseFragment == null) {
            mPhotoChooseFragment = PhotoChooseFragment()
            mPhotoChooseFragment!!.setPhotoChooseListener(this)
            childFragmentManager
                .beginTransaction()
                .add(mPhotoChooseFragment, PhotoChooseFragment.TAG)
                .commitAllowingStateLoss()
        }
    }

    override fun onPicked(
        pickerBSDialogFragment: BottomPickerDialogFragment,
        position: Int,
        selected: String
    ) {
        // 根据用户选择打开相机或者相册
        when (position) {
            0 -> mPhotoChooseFragment?.openCamera()
            1 -> mPhotoChooseFragment?.openGallery()
        }
    }

    override fun onPhotoChooseSuccess(cropFile: File?) {
        // 选择文件后的回调
        if (cropFile == null) {
            ToastUtils.showLongToast("文件异常，请重试。")
            return
        }
        // TODO 上传并加载头像
    }
}
```

!!! danger
    注意在AndroidManifest中注册权限，以及处理好N以上平台的`FileProvider`问题


---
后记，其实拿到了原始数据后，往自己的文件夹重新写入一下，应该是一个更安全的方式。