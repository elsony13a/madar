# تشغيل الـ backend في Docker (من غير Lambda) | Madar

ده دليل تشغيل نفس كود الـ backend بتاع مدار كسيرفر عادي جوه container، بدون تغيير أي ملف من الملفات الموجودة. الإضافة كلها ملف واحد: `backend/server.mjs` بيلف الـ handler الأصلي في HTTP server حقيقي، ومعاه `Dockerfile`.

## اللي اتعمل

- `backend/server.mjs`: سيرفر Node صافي (من غير مكتبات زيادة) بيستقبل requests ويبعتها لنفس `handler.mjs` الموجود. فيه:
  - CORS من متغير `ALLOWED_ORIGINS` (أصل الـ API Gateway كان بيعمله).
  - `GET /health` للتأكد إن السيرفر عايش.
  - نفس حدود الحجم ونفس الردود بتاعت النسخة الأصلية.
- `backend/Dockerfile`: صورة `node:22-alpine`، بتثبت dependencies بـ `npm ci --omit=dev` وتشغّل بمستخدم مش root.

## مهم: الـ serverless اتحذف من التشغيل فقط، مش من AWS

الكود بيستخدم خدمات AWS حقيقية مهما اشتغل فين:

- **Cognito** لتسجيل الدخول (الـ JWT بيتفحص جوه الكود نفسه، مش محتاج API Gateway).
- **DynamoDB** للبيانات: لازم تعمل جدول بنفسك: اسم تختاره، نوع المفاتيح `PK` (String, HASH) و `SK` (String, RANGE)، و Billing mode: On-demand.
- **S3 bucket خاص** للفيديوهات والإيصالات، وعليه CORS يسمح برابط الفرونت إند (PUT/POST/GET مع header content-type) عشان الرفع من المتصفح.
- **صلاحيات**: الـ container محتاج مفاتيح IAM عنده إذن على الجدول والـ bucket بس (`AWS_ACCESS_KEY_ID` و `AWS_SECRET_ACCESS_KEY`).

يعني مش هتعمل API Gateway ولا Lambda، بس الجدول والـ bucket والـ pool لسه مطلوبين.

## متغيرات البيئة

| المتغير | إلزامي؟ | قيمته |
| --- | --- | --- |
| `USER_POOL_ID` | أيوه | من Cognito (زي eu-central-1_XXXX) |
| `CLIENT_ID` | أيوه | الـ app client العام |
| `AWS_REGION` | أيوه | نفس منطقة الـ pool والجدول |
| `TABLE_NAME` | أيوه | اسم جدول DynamoDB |
| `PRIVATE_BUCKET` | أيوه | اسم الـ bucket الخاص |
| `ALLOWED_ORIGINS` | أيوه | رابط الفرونت بالظبط، زي `https://maadar.vercel.app` (ممكن كذا رابط بفواصل) |
| `PAYMENT_MODE` | لا | `disabled` (الافتراضي) أو `test` |
| `MANUAL_PAYMENT_INSTRUCTIONS` | لا | فاضي مبدئيًا |
| `PORT` | لا | 3000 افتراضيًا |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | أيوه | مفاتيح IAM |
| `BEDROCK_ENABLED` | لا | سيبها مش موجودة، مقفول افتراضيًا |

## التشغيل

```bash
cd backend
docker build -t madar-backend .
docker run --rm -p 3000:3000 \
  -e USER_POOL_ID=... -e CLIENT_ID=... -e AWS_REGION=... \
  -e TABLE_NAME=... -e PRIVATE_BUCKET=... \
  -e ALLOWED_ORIGINS=https://maadar.vercel.app \
  -e AWS_ACCESS_KEY_ID=... -e AWS_SECRET_ACCESS_KEY=... \
  madar-backend
```

تأكد إنه شغال:

```bash
curl http://localhost:3000/health
```

لازم يرجع `{"ok":true}`.

## ربط الفرونت إند

في `web/config.js` حط `apiBaseUrl` على عنوان الـ container، وبعدها `npm run build` وارفع تاني.

خد بالك: كود الفرونت إند بيشترط إن `apiBaseUrl` يبدأ بـ `https://`. محليًا على `http://localhost:3000` هيرفض. يعني للربط النهائي الـ container محتاج يتستضاف ورا HTTPS (دومين + شهادة، أو أي منصة containers بتدي رابط https جاهز). دي خطوة الاستضافة، ولو عايز تتعلمها بنفسك برضه، دي طبيعية.

## حدود

- مفيش throttling زي اللي API Gateway كان بيعمله.
- الجدول والـ bucket عليهم تكلفة حسب الاستخدام، راجع ميزانية حسابك.
- `npm test` في الـ backend لسه شغال وبيختبر نفس المنطق من غير AWS.
