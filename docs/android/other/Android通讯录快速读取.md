---
title: "Android通讯录快速读取"
---

Android中联系人的相关信息都由一个系统应用保存着，这个应用就是 **ContactsProvider** ，它是一个系统级别的Provider，是我们不可见的。

在桌面上的Contacts应用可以操作联系人本质上就是通过Provider对联系人数据进行CRUD操作。

ContactsProvider的源码在`packages/providers/ContactsProvider`中，其包名是`com.android.providers.contacts`。

## 1 ContactsProvider底层的数据库

我们直接看一下ContactsProvider底层的数据库：这个文件在手机目录的`/data/data/com.android.providers.contacts/databases/contacts2.db`中。

该数据库有很多的表，但是我们常用的也就那么几个而已：

| 表名 | 含义 | 备注 |
| ------ | ------ | ------ |
| accounts | 通讯录账号表 | 一般会有一个本地账号，如果登录了Google账户的话，还有一个Google账户 |
| contacts | 通讯录表 | 记录着头像、铃声、联系次数、联系时间等等信息 |
| data | 数据表 | 存储着一些email、组织机构、网站等额外信息 |
| mimetypes | mimeType表 | 一个将URI映射成id的表格，16种URI |
| raw_contacts | 原始的通讯录表 | 数据最全的一张表，可以找到大多数信息 |

### 1.1 accounts表
![accounts表](/assets/images/android/accounts表.png)

可以看到，这里有两个账户，第一个就是默认的本地账户。第二个是我登陆了Google之后添加Google账户。

### 1.2 contacts表
![contacts表](/assets/images/android/contacts表.png)

这是所有的字段，`name_raw_contact_id`是表`raw_contacts`的外键，另外还有`custom_ringtone`、`times_contacted`、`last_time_contacted`等等字段，都是与通话情况有关的字段。

### 1.3 data表
![data表](/assets/images/android/data表.png)

data表里面的字段很多，但是我们只需要几个就能完成我们的任务了。分别是`mimetype_id`、`raw_contact_id`以及`data1`。这几个字段我们就能取出16种不同的信息。

### 1.4 mimetypes表
![mimetypes表](/assets/images/android/mimetypes表.png)

我们使用代码查找某一类的信息时，可以使用mimeType，这是一个URI，传入后可以在这个表中找到对应的id，然后在`data`表中根据配合要查找的联系人的id，可以取出其data字段。

### 1.5 raw_contacts表
这个表的字段也非常多，是信息最全的一个表了。我们主要需要两个字段`_id`以及`display_name`。前面的字段就是上文中看到的`raw_contact_id`，`display_name`就是联系人姓名了。

### 1.6 举个查找联系人的例子
下面我们根据实例来跑一遍这个数据库。我在通讯录中加了一个Test的联系人，加了三个电话号码。
首先，根据联系人姓名"Test"找到在`raw_contact`中找到`_id`。发现其`_id`是133，`account_id`为1，这说明保存在本地账号中。

新增联系人肯定在`raw_contact`表中最后，`_id`也是最大的。因此，直接找最后一条数据即可。

然后在`data`表中搜`raw_contact_id`为133的数据：
```sql
select data._id, mimetypes._id mimetype_id, mimetypes.mimetype mimetypes, data.raw_contact_id, data.data1
from mimetypes, data
where data.raw_contact_id = 133 AND mimetypes._id = data.mimetype_id;
```

查询结果如下  
![查询结果](/assets/images/android/查询结果.png)

这里我们一次直接查出了联系人的姓名以及三个联系电话。

在Android系统中，使用`ContactsContract.CommonDataKinds.Phone.CONTENT_URI`查询联系人，当同一个联系人有多个电话时，会该联系人的多条数据，每一条对应不同的联系电话。  
如果只需要提取联系人的姓名以及联系电话，对其他的一些信息不感兴趣的话。可以在获取联系人ID之后，直接根据ID查找data。这样好合并同一个联系人的多个联系电话。

## 2 快速获取用户通讯录信息

下面附上我最近优化的代码，这段代码会将同名的联系人电话全部合并到一个Map里面。

```java
public class ContactUtils {
    public static List<Map<String, String>> getLocalContactsAllInfos(Context context) {
        List<Map<String, String>> result = new ContactUtils().getLocalContactsAllInfo(context);
        return result;
    }

    private boolean debug = false;
    private String mLastContactId;
    public ContactUtils() {
        mLastContactId = null;
    }

    public List<Map<String, String>> getLocalContactsAllInfo(Context context) {
        Uri uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI; // 联系人Uri；
        List<Map<String, String>> contactInfos = new ArrayList<>();
        Cursor cur = null;
        try {
            ContentResolver cr = context.getContentResolver();
            cur = cr.query(uri, null, null, null, ContactsContract.CommonDataKinds.Phone.CONTACT_ID);
            if (cur != null) {
                while (cur.moveToNext()) {
                    try {
                        String contactId = cur.getString(cur.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID));
                        if (contactId.equals(mLastContactId)) {
                            continue;
                        } else {
                            mLastContactId = contactId;
                        }

                        String[] names = cur.getColumnNames();
                        Map<String, String> map = new HashMap<>();
                        for (String s : names) {
                            map.put(s, cur.getString(cur.getColumnIndex(s)));
                        }
                        String name = map.get(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                        map.put("name", name);
                        String sortString = PinyinUtils.getPinyinFirstLetter(name).toUpperCase(Locale.getDefault());
                        // 正则表达式，判断首字母是否是英文字母
                        if (sortString.matches("[A-Z]")) {
                            map.put("sortLetters", sortString.toUpperCase(Locale.getDefault()));
                        } else {
                            map.put("sortLetters", "#");
                        }

                        parseData(cr, map.get(ContactsContract.CommonDataKinds.Phone.CONTACT_ID), map);

                        contactInfos.add(map);
                    } catch (Exception e) {
                        continue;
                    }
                }

            }
        } catch (Exception e) {
        } finally {
            if (cur != null) {
                cur.close();
                cur = null;
            }
        }
        return contactInfos;
    }

    private void parseData(final ContentResolver contentResolver, String contactId, Map<String, String> map) {
        StringBuilder phoneNumberBuilder = new StringBuilder();

        List<String> mimeTypes = new ArrayList<>(8);
        mimeTypes.add(ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE); // email
        mimeTypes.add(ContactsContract.CommonDataKinds.StructuredPostal.CONTENT_ITEM_TYPE); // address
        mimeTypes.add(ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE); // note
        mimeTypes.add(ContactsContract.CommonDataKinds.Nickname.CONTENT_ITEM_TYPE); // nickname
        mimeTypes.add(ContactsContract.CommonDataKinds.Website.CONTENT_ITEM_TYPE); // website
        mimeTypes.add(ContactsContract.CommonDataKinds.Relation.CONTENT_ITEM_TYPE); // relation
        mimeTypes.add(ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE); // company & jobTitle
        mimeTypes.add(ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE); // phoneNum

        Cursor dataCursor = contentResolver.query(
                ContactsContract.Data.CONTENT_URI,
                new String[] {ContactsContract.Data.MIMETYPE, ContactsContract.Data.DATA1,
                        ContactsContract.CommonDataKinds.Organization.DATA, ContactsContract.CommonDataKinds.Organization.TITLE},
                ContactsContract.Data.CONTACT_ID + "= ? AND "
                        + ContactsContract.Data.MIMETYPE + " in ('"
                        + TextUtils.join("', '", mimeTypes) + "')",
                new String[]{String.valueOf(contactId)},
                null);
        if (dataCursor != null && dataCursor.getCount() > 0) {
            if (debug) {
                Log.e("Yorek", " ----------------------------------- " + contactId + " -- " + map.get("name") + "------------------------------");
            }
            while (dataCursor.moveToNext()) {
                String mimeType = dataCursor.getString(dataCursor.getColumnIndex(ContactsContract.Data.MIMETYPE));
                String data1 = dataCursor.getString(dataCursor.getColumnIndex(ContactsContract.Data.DATA1));
                String company = dataCursor.getString(dataCursor.getColumnIndex(ContactsContract.CommonDataKinds.Organization.DATA));
                String title = dataCursor.getString(dataCursor.getColumnIndex(ContactsContract.CommonDataKinds.Organization.TITLE));
                if (debug) {
                    Log.e("Yorek", contactId + ", " + mimeType + ", " + data1 + ", " + company + ", " + title);
                }
                switch (mimeType) {
                    case ContactsContract.CommonDataKinds.Email.CONTENT_ITEM_TYPE:
                        map.put("email", data1);
                        break;

                    case ContactsContract.CommonDataKinds.StructuredPostal.CONTENT_ITEM_TYPE:
                        map.put("address", data1);
                        break;

                    case ContactsContract.CommonDataKinds.Note.CONTENT_ITEM_TYPE:
                        map.put("note", data1);
                        break;

                    case ContactsContract.CommonDataKinds.Nickname.CONTENT_ITEM_TYPE:
                        map.put("nickName", data1);
                        break;

                    case ContactsContract.CommonDataKinds.Website.CONTENT_ITEM_TYPE:
                        map.put("website", data1);
                        break;

                    case ContactsContract.CommonDataKinds.Relation.CONTENT_ITEM_TYPE:
                        map.put("relation", data1);
                        break;

                    case ContactsContract.CommonDataKinds.Phone.CONTENT_ITEM_TYPE:
                        phoneNumberBuilder.append(formatPhoneNUmber(data1)).append(",");
                        break;

                    case ContactsContract.CommonDataKinds.Organization.CONTENT_ITEM_TYPE:
                        map.put("company", company);
                        map.put("jobTitle", title);
                        break;

                    default:
                }
            }
        }
        String result = phoneNumberBuilder.toString();
        if (!TextUtils.isEmpty(result) && result.length() > 0) {
            result = result.substring(0, result.length() - 1);
        }
        map.put("phoneNum", result);

        dataCursor.close();
    }

    private String formatPhoneNUmber(String phoneNumber) {
        return phoneNumber.replace(" ", "").replace("+86", "").replace("0086", "");
    }
}
```

在优化前，测试了一下这部分代码的运行速度，发现大部分时间花在了根据`contactId`在`data`表中，前前后后总共在`data`表中查找了8次。  
而结合上面的分析我们知道，data表中的数据非常之多，因为每个联系人16种信息都会在里面。每查找一次都非常耗时，这导致了用户体验极为不好。

优化后，上面这段代码读取150个联系人的信息只需要2s多一点。10次测试结果表明，速度比优化前快了6倍多。
