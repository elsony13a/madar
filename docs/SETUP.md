# التشغيل وربط AWS | Setup

## 1. معاينة آمنة أولًا

ابدأ بملف `Madar-Preview.html`، أو شغّل `npm ci` ثم `npm run dev` من مجلد المشروع. الوضع الافتراضي `demo`. لا تدخل كلمات سر AWS أو مفاتيح أو أرقام محافظ في الكود.

مسار تجربة كامل: طالب > كورس مدفوع > صورة اختبار > الطلب pending > Test role > owner > قبول تجريبي > student > My learning. مجرد رفع الصورة لا يفتح الكورس.

الكورسات والأسعار والمدد في البيانات التجريبية عينات توضيحية. لغة الواجهة مستقلة عن لغة الشرح المختارة للكورس.

## 2. افهم الموارد والتكلفة قبل النشر

**الخطوات التالية اختيارية. لم يتم تنفيذها لك.** تحتاج AWS CLI وSAM CLI وحسابًا تختار أنت منحه صلاحية النشر. راجع الحساب والمنطقة والأذونات أولًا.

القالب ينشئ Cognito user pool/client/domain وgroup للمالك، وHTTP API وLambda وCloudWatch logs، وDynamoDB on-demand مع point-in-time recovery، وS3 خاصًا مع versioning للملفات، وS3 وCloudFront للواجهة. Cognito مضبوط على Lite وواجهة hosted UI classic؛ تصميم شاشة Cognito نفسها ليس نفس تصميم Madar.

كل من الطلبات، التخزين، نسخ S3 السابقة، النقل، CloudFront، السجلات وPITR يمكن أن يضيف تكلفة. لا توجد قاعدة بيانات RDS أو NAT Gateway هنا. API throttling ليس حدًا ماليًا. راجع تسعير منطقتك، واضبط ميزانية وتنبيهات حسابك قبل النشر. موارد البيانات وCognito وS3 عليها `Retain`، ولذلك حذف الـstack لا يحذفها ولا يوقف كل تكاليفها.

لا تنفّذ النشر إذا كنت تريد التصميم فقط.

## 3. مسار نشر واحد، بعد قرارك

الأوامر التالية أمثلة تنفيذ لك، وليست عمليات تم تنفيذها. اختر اسم stack ومنطقة جديدة لهذا المشروع. لا تستخدم قيم مشروع قديم بالصدفة.

```bash
npm ci
npm --prefix backend ci
npm test
npm run build:backend
sam validate --lint
sam build
sam deploy --guided
```

في `sam deploy --guided`:

- اختر المنطقة التي تريدها، ولا تعتمد على default غير مراجع.
- أعطِ `CognitoDomainPrefix` بادئة فريدة، أحرف صغيرة وأرقام وشرطات.
- اترك `FrontendOrigin=http://localhost:8080`، و`CallbackUrl` و`LogoutUrl` بقيمة `http://localhost:8080/` للاختبار المحلي. القالب يضيف عنوان CloudFront الخاص به تلقائيًا أيضًا.
- اختر `PaymentMode=disabled` مبدئيًا. لتجربة صور غير حقيقية دون تحويل، اختر `test`. وضع `manual` الحقيقي لا يُستخدم قبل مراجعة الحماية والتشغيل وكتابة تعليمات استلام تخصك بشكل واضح.
- اترك `ManualPaymentInstructions` فارغًا في `disabled` أو `test`. ليست هناك حاجة لرقم محفظة الآن. لا تدخل PIN أو كلمة سر أو بيانات بطاقات فيه أبدًا.
- راجع changeset والموارد وأذونات IAM قبل موافقة النشر. النشر قد يتعثر بسبب حصص الحساب أو domain غير متاح أو صلاحيات أو اختلاف المنطقة. لم يتم اختبار هذه الخطوة على حسابك.

لا يوجد `Function URL`. الـLambda خارج VPC، لتصل لـCognito وDynamoDB وS3 دون إعداد NAT أو VPC endpoints. API Gateway يفحص JWT، والـLambda يفحص access token بنفسه أيضًا.

## 4. إعداد الواجهة من مخرجات الـstack، من غير إعادة كتابة IDs يدويًا

بعد نجاح النشر فقط، استبدل `YOUR_STACK` و`YOUR_REGION` بالقيم التي نشرتها أنت:

```bash
aws cloudformation describe-stacks --stack-name YOUR_STACK --region YOUR_REGION --output json > stack-outputs.json
node scripts/configure-aws.mjs stack-outputs.json
npm run build
```

السكريبت يكتب إعدادات عامة فقط في `web/config.js`: API endpoint وCognito domain وpool/client IDs وcallback. لا يوجد client secret في المتصفح. لا يرسل شيئًا ولا يرفع ملفات.

للاختبار المحلي بدل CloudFront:

```bash
node scripts/configure-aws.mjs stack-outputs.json --local
npm run dev
```

افتح `http://localhost:8080/`، وليس `127.0.0.1`، لأن Cognito وCORS يحتاجان تطابق العنوان بالضبط. عند الرفع لـCloudFront أعد تشغيل سكريبت الإعداد **من غير `--local`** ثم ابنِ الواجهة مجددًا.

سيكون الكتالوج الحقيقي فارغًا أول مرة. لا يتم نسخ عينات المعاينة تلقائيًا إلى DynamoDB.

## 5. رفع الواجهة، بعد التأكد من config

استخرج قيمة `WebsiteBucketName` من مخرجات الـstack نفسها. لا تخمّن اسم bucket. راجع أن `dist/` يحتوي فقط الواجهة العامة المبنية، وليس ملفات backend أو إيصالات أو مفاتيح.

```bash
aws s3 sync dist/ s3://YOUR_WEBSITE_BUCKET/ --cache-control max-age=300
```

افتح `WebsiteUrl` الوارد في المخرجات. الـbucket ليس عامًا؛ CloudFront له وصول OAC للواجهة فقط، وليس bucket الفيديوهات والإيصالات.

عند تحديث الواجهة، يمكن الانتظار لانتهاء cache أو تنفيذ invalidation بعد مراجعة تكلفته:

```bash
aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths '/*'
```

لا تضع تطبيقًا حقيقيًا على file://. ملف HTML المستقل للمعاينة التجريبية فقط. وضع AWS يحتاج origin صحيحًا وHTTPS عند الاستضافة.

## 6. إنشاء الحسابات والأدوار

أنشئ حساب اختبار مدرس وحساب طالب منفصلًا من واجهة Cognito. اختر نوع الحساب في Madar قبل المتابعة لتسجيل الدخول. يتم حفظ الدور من السيرفر بعد أول دخول. يمكن للطالب الترقية إلى مدرس من صفحة طلباته؛ هذا لا يمنح دور admin.

المسار الحقيقي للمالك منفصل: بعد أن يسجل المالك حسابه، يضيفه مسؤول حساب AWS إلى group اسمها `MadarAdmins`. استخدم **اسم المستخدم الفعلي من Cognito** ولا تخمّن الهوية من اسم مشابه:

```bash
aws cognito-idp admin-add-user-to-group --user-pool-id YOUR_POOL_ID --username OWNERS_COGNITO_USERNAME --group-name MadarAdmins --region YOUR_REGION
```

هذا أمر يغير الأذونات، لا تنفذه لمستخدم غير مقصود. بعد الإضافة سجّل خروجًا ودخولًا للحصول على token جديد. لا توجد واجهة تجعل أي مستخدم أدمن بنفسه. للمالك حساب منفصل عن حساب الطالب، لأن السيرفر يرفض مراجعة الشخص لطلبه هو.

## 7. اختبار قبول AWS قبل اعتبار الربط شغالًا

- [ ] الصفحة تفتح عبر CloudFront بدون أخطاء أو ملفات 403.
- [ ] تسجيل حساب وتأكيد الإيميل والدخول والخروج من Cognito يعملون.
- [ ] callback وlogout يرجعان لنفس origin المسجل.
- [ ] token غير صالح أو منتهي أو ID token بدل access token يرجع 401.
- [ ] حساب الطالب لا يصل لواجهات المالك، حتى بطلب API مباشر.
- [ ] المدرس ينشئ مسودة عربية/إنجليزية، يراجعها ويحدد السعر، ثم يرسلها للمراجعة. حساب مالك منفصل يقرأ المحتوى ويوافق وينشر أو يعيدها للمسودة.
- [ ] الطالب يرى الكورس المنشور فقط، ولا يرى مسودات أو نصوص الدروس من catalogue API.
- [ ] الانضمام المجاني يحفظ enrollment وتقدم الدرس بين الجلسات وعلى جهاز آخر لنفس الحساب.
- [ ] فيديو اختبار MP4/WebM حتى 100 MB يرفع لـS3 الخاص، ولا ينشر درس فيديو ناقص الرفع.
- [ ] URL ثابت غير موقع للفيديو لا يفتح. الطالب غير المشترك لا يحصل على signed URL.
- [ ] في `PaymentMode=test`، صورة اصطناعية JPG/PNG حتى 5 MB تنشئ طلبًا موسومًا TEST ONLY. لا يحدث تحويل.
- [ ] رفع الصورة وحده لا يمنح enrollment أو وصول الدرس.
- [ ] المالك يرى نفس نسخة الإيصال التي أُرسلت؛ نسخة S3 محفوظة مع الطلب.
- [ ] الرفض لا يفتح الكورس. القبول التجريبي من حساب مالك آخر يفتحه.
- [ ] تكرار القبول أو قبولان متزامنان لا يمنحان وصولًا مكررًا.
- [ ] السعر وهوية الطالب يؤخذان من السيرفر، وليس من body قابل للتعديل.
- [ ] اختبر انقطاع الشبكة وCORS والملف الكبير وإلغاء login. لا يحدث fallback صامت إلى demo.

لم يتم وضع علامة نجاح على أي بند AWS هنا. الاختبارات المحلية لا تعوض هذه القائمة.

## قبول إضافات v2 على AWS

- [ ] أنشئ مسودة اختبار من حساب المدرّس باللغتين وحدد نسبة نجاح صحيحة، ثم انشرها.
- [ ] API الطالب المسجل يعيد أسئلة واختيارات من غير correctIndex، وغير المشترك يرفض طلبه.
- [ ] إرسال الاختبار قبل إكمال الدروس مرفوض. حقول score/passed المزيفة لا تؤثر على النتيجة.
- [ ] المحاولة الفاشلة لا تمسح أفضل نتيجة أو نجاحًا سابقًا.
- [ ] سجل الإكمال مرفوض قبل الشروط، وثابت الاسم والتاريخ بعد الإصدار. لا يمكن لحساب آخر قراءته.
- [ ] الحفظ لا يمنح اشتراكًا، وقائمة كل مستخدم منفصلة.
- [ ] تقييم غير المشترك أو مالك الكورس مرفوض. التقييم الجديد لا يظهر قبل مراجعة المالك، والتعديل يعيده للمراجعة.
- [ ] الطالب والمدرّس لا يستطيعان استعمال `/admin/reviews` بطلب API مباشر.
- [ ] تعديل بيانات الكورس المنشور لا يغيّر الدروس أو الاختبار أو التقدم أو سجل الإكمال السابق، وطلب دفع قديم يحتفظ بالسعر الأصلي.

كل هذه الاختبارات السحابية ما زالت غير منفذة. راجع `V2-RELEASE.md` لطريقة تجربة النسخة المحلية وحدود السجلات والشهادات.

## قبول إضافات v3 على AWS

- [ ] ملاحظات الطالب تُحفظ وتُفتح من حسابه على جهاز آخر؛ حساب طالب آخر لا يقرأها، وغير المشترك مرفوض.
- [ ] lessonId غير تابع للكورس أو ملاحظة تتجاوز 8000 حرف مرفوضان، وحفظ نص فارغ يمسح المحتوى.
- [ ] سؤال الطالب يظهر للمشتركين فقط؛ اسم العرض معلن والهوية الداخلية غير مرسلة لهم.
- [ ] مدرّس الكورس يرد، ومدرّس آخر يرفضه السيرفر حتى بطلب مباشر أو questionId من كورس آخر.
- [ ] المالك يخفي ويستعيد النقاش. المخفي يبقى ظاهرًا لصاحبه والمدرّس والمالك فقط، ولا يقبل ردًا جديدًا.
- [ ] الطالب والمدرّس لا يغيران حالة النقاش بطلب مباشر لواجهات admin.
- [ ] لوحة المدرّس لا تعرض كورسات أو بيانات طلاب لمدرّس آخر. مبالغ TEST وMANUAL منفصلة وليست أرباحًا مؤكدة.
- [ ] اختبر تعارض تعديل الرد مع إخفاء النقاش، ثم أعد القراءة قبل إعادة المحاولة.

هذه بنود اختبار لاحق، وليست نتائج ناجحة على AWS. راجع `V3-RELEASE.md` للتجربة المحلية.

## قبول إضافات v4 على AWS

- [ ] إرسال الكورس يضعه pending-review. لا يظهر للطالب أو في API العام ولا يقبل enrollment.
- [ ] تعديل المسودة أو بياناتها أو إنشاء رفع فيديو جديد أثناء المراجعة مرفوض.
- [ ] حساب طالب أو مدرس لا يصل لقائمة مراجعة النشر أو رابط فيديو المراجعة بطلب API مباشر.
- [ ] حساب المالك منفصل عن صاحب الكورس؛ مراجعة الشخص لكورسه مرفوضة حتى إن كان ضمن MadarAdmins.
- [ ] المالك يقرأ النصوص باللغتين ومفتاح الاختبار ويشاهد نسخة الفيديو المحددة؛ الموافقة بلا contentChecked أو ملاحظة مرفوضة.
- [ ] الرفض يعيد الكورس للمسودة بملاحظة. السحب يعيد التعديل. إعادة الإرسال تغيّر submissionId؛ قرار شاشة قديمة مرفوض.
- [ ] تغيير ملف S3 بعد الإرسال لا يستبدل نسخة الفيديو التي راجعها المالك أو النسخة المنشورة.
- [ ] بلاغ غير المشترك أو questionId من كورس آخر أو هوية مراسل مزيفة مرفوض أو متجاهل كما في عقد API.
- [ ] الطالب يرى بلاغاته فقط، والمدرّس لا يرى بلاغات الطلاب، والمالك وحده يسجل النتيجة.
- [ ] نسخة النقاش في البلاغ لا تتغير بتعديل رد المدرّس بعده. ملاحظة النتيجة تظهر لصاحب البلاغ فقط ضمن الجمهور المسموح.
- [ ] إغلاق البلاغ لا يحذف المحتوى أو يغير الاشتراك أو يحرك أموالًا. تحديثان متعارضان لا يمسحان نتيجة سابقة بصمت.

هذه اختبارات قبول لاحقة غير منفذة على AWS. مسار publish القديم صار إرسالًا للمراجعة، فحدّث أي عميل آخر يعتمد عليه. لا توجد إعادة مراجعة تلقائية للكورسات القديمة أو لتعديل بيانات كورس منشور. لم يضف هذا الإصدار خدمة أو مورد AWS جديدًا إلى القالب.

## 8. قبل دفع حقيقي أو مستخدمين حقيقيين

اقرأ `SECURITY.md`. هذه نسخة تعليمية، وليست خدمة دفع أو منصة إنتاج جاهزة. أضف MFA للمالك، مراجعة المحتوى والملفات ومكافحة الإساءة وسياسات الخصوصية والاسترداد والاحتفاظ والأرشفة والتنبيهات. لا تفتح وضع `manual` لمستخدمين فعليين بناءً على نجاح المعاينة وحده.

## 9. التنظيف

لا يوجد cleanup تلقائي أو أمر يحذف بياناتك ضمن السكريبتات. عند إنهاء المختبر، راجع الـstack وكل الموارد المحتفظ بها: user pool وDynamoDB ونسخ S3 والإيصالات والفيديوهات وbucket الواجهة والسجلات وCloudFront. حذف ملفات S3 الحالية لا يحذف بالضرورة النسخ السابقة. خذ نسخة مما تريد الاحتفاظ به، ثم احذف فقط ما تقرره وتتحقق منه. لا تعتبر حذف الـstack دليلًا أن فاتورة الموارد انتهت.

## V5 Bedrock, disabled unless separately approved

Leave `BedrockEnabled=false`, model and region empty for normal local/demo work or deployment without inference. This source work does not authorize enabling it. Read BEDROCK.md before choosing a compatible in-region base model, its region, access prerequisites, pricing/data handling and approved budget. Only after that separate decision should an authorized deployer supply the three Bedrock parameters. Template IAM is conditional and model/region scoped. No Marketplace permissions, model subscription or inference was performed. No new resource is required solely for this optional adapter, but usage can incur charges.

Live acceptance, all unrun: disabled status/no invocation; wrong-role/foreign-owner denial; compatible model/system-message response; correct bilingual/answer-key quality; invalid/truncated response rejection; duplicate ID without second inference; daily caps under concurrency; stale adoption denial; reviewed adoption/manual editing; owner publication review; deterministic student scoring and answer-key exclusion. Inspect actual account invocation logging, retention and billed usage rather than relying on local mock tests.
