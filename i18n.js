/* English / Arabic UI. English is the default.

   - Load this in <head> (not deferred): it sets <html lang dir> before the page paints.
   - Static text: data-i18n="key" (textContent), data-i18n-ph (placeholder),
     data-i18n-aria (aria-label), data-i18n-title (title), data-i18n-content (meta content).
   - Script text: I18n.t('key', {var: value}) with {var} placeholders.
   - Pages re-render their dynamic text in I18n.onChange(callback).
   - The choice is remembered in the browser; ?lang=ar or ?lang=en overrides it. */
(function (global) {
  'use strict';

  const KEY = 'ledsc.lang';
  const LANGS = ['en', 'ar'];

  // key: [English, Arabic]
  const D = {
    // ---- common
    'lang.toggle': ['العربية', 'English'],
    'lang.toggleAria': ['Switch to Arabic', 'التحويل للإنجليزي'],
    'nav.home': ['Home', 'الصفحة الرئيسية'],
    'nav.sections': ['Sections', 'الأقسام'],
    'nav.abstract': ['Backgrounds', 'الخلفيات'],
    'nav.test': ['Test patterns', 'صور اختبار'],
    'res.title': ['Resolution', 'الرزلوشن'],
    'res.w': ['Width (px)', 'العرض (px)'],
    'res.h': ['Height (px)', 'الارتفاع (px)'],
    'res.presets': ['Presets', 'Presets'],
    'res.pick': ['— Choose —', '— اختار —'],
    'res.cab': ['Calculate from cabinets', 'حساب بالكابينات'],
    'cab.cols': ['Columns', 'عدد الأعمدة'],
    'cab.rows': ['Rows', 'عدد الصفوف'],
    'cab.w': ['Cabinet width (px)', 'عرض الكابينة (px)'],
    'cab.h': ['Cabinet height (px)', 'ارتفاع الكابينة (px)'],
    'panel.label': ['Cabinet type (pixel pitch)', 'نوع الكابينة (pixel pitch)'],
    'panel.custom': ['Custom size', 'مقاس مخصوص'],
    'panel.gIndoor': ['Indoor 500 × 500 mm', 'إندور ⁦500 × 500 mm⁩'],
    'panel.gIndoorTall': ['Indoor 500 × 1000 mm', 'إندور ⁦500 × 1000 mm⁩'],
    'panel.g640': ['Indoor 640 × 480 mm', 'إندور ⁦640 × 480 mm⁩'],
    'panel.gFine': ['Fine pitch 16:9 (600 × 337.5 mm)', 'Fine pitch ⁦16:9⁩ (⁦600 × 337.5 mm⁩)'],
    'panel.gOutdoor': ['Outdoor 960 × 960 mm', 'آوت دور ⁦960 × 960 mm⁩'],
    'panel.size': ['Diagonal: {d}', 'القطر: ⁦{d}⁩'],
    'scr.w': ['Screen width (m)', 'عرض الشاشة (متر)'],
    'scr.h': ['Screen height (m)', 'ارتفاع الشاشة (متر)'],
    'scr.needPanel': ['Choose a cabinet type to enter the screen size in meters.', 'اختار نوع الكابينة الأول عشان تكتب مقاس الشاشة بالمتر.'],
    'scr.rounded': ['Rounded to whole cabinets: {w} × {h} m.', 'اتقرّب لأقرب عدد كباين كامل: ⁦{w} × {h} m⁩'],
    'sum.cabinets': ['Cabinets', 'عدد الكباين'],
    'sum.area': ['Area', 'المساحة'],
    'sum.pixels': ['Pixels', 'البكسل'],
    'sum.size': ['Screen size', 'مقاس الشاشة'],
    'preset.portrait': ['Full HD portrait', 'Full HD عمودي'],
    'preset.wide2': ['2 × Full HD wide', '2 × Full HD عرض'],
    'preset.wide3': ['3 × Full HD wide', '3 × Full HD عرض'],
    'preset.wide4': ['4 × Full HD wide', '4 × Full HD عرض'],
    'err.zero': ['Width and height must be greater than zero.', 'العرض والارتفاع لازم يكونوا أكبر من صفر.'],
    'err.side': ["The browser's maximum for either side is {max} px.", 'أقصى طول لأي ضلع في المتصفح {max} px.'],
    'err.area': ["This resolution is over the browser's limit.", 'الرزلوشن أكبر من حد المتصفح.'],
    'err.areaMp': ["The image is over the browser's limit ({mp} megapixels).", 'الصورة أكبر من حد المتصفح ({mp} ميجا بكسل).'],
    'warn.safari': ['This resolution may not work in Safari on iPhone or iPad. Use Chrome or Edge on a computer.', 'الرزلوشن ده ممكن مايشتغلش على Safari في الآيفون/الآيباد. استخدم Chrome أو Edge على الكمبيوتر.'],
    'st.preparing': ['Preparing…', 'بيتجهز…'],
    'st.saved': ['Downloaded: {name} ({mb} MB)', 'اتحمّل: {name} ({mb} MB)'],
    'st.declined': ['Download cancelled.', 'التحميل اتلغى.'],
    'st.saveFailed': ["Couldn't save the file.", 'مقدرتش أحفظ الملف.'],
    'st.tooBig': ["The browser couldn't create this image. The resolution is probably too large for this device.", 'المتصفح مقدرش يعمل الصورة دي — غالباً الرزلوشن كبير على الجهاز ده.'],
    'pos.tl': ['Top left', 'فوق شمال'],
    'pos.t': ['Top', 'فوق'],
    'pos.tr': ['Top right', 'فوق يمين'],
    'pos.l': ['Left', 'شمال'],
    'pos.c': ['Center', 'النص'],
    'pos.r': ['Right', 'يمين'],
    'pos.bl': ['Bottom left', 'تحت شمال'],
    'pos.b': ['Bottom', 'تحت'],
    'pos.br': ['Bottom right', 'تحت يمين'],

    // ---- home
    'home.docTitle': ['LED Screen Content', 'LED Screen Content'],
    'home.desc': ['Tools for making LED screen content at any resolution: abstract background images and videos, and test patterns.', 'أدوات لعمل محتوى شاشات الـ LED بأي رزلوشن: خلفيات Abstract صور وفيديو، وصور اختبار.'],
    'home.navTools': ['Tools', 'الأدوات'],
    'home.navHow': ['How it works', 'إزاي بتشتغل'],
    'home.start': ['Start', 'ابدأ'],
    'home.h1a': ['Content for LED screens,', 'محتوى لشاشات الـ LED'],
    'home.h1b': ['at their exact resolution', 'بالرزلوشن بتاعها بالظبط'],
    'home.lede': ['Abstract backgrounds and test patterns at any size, even unusual or ultra-wide ones. PNG images and seamlessly looping MP4 videos, with your company logo and event name. Everything runs in the browser.', 'خلفيات Abstract وصور اختبار بأي مقاس، حتى لو غريب أو عريض جدًا. صور PNG وفيديو MP4 بيلف من غير قطع، ومعاهم لوجو الشركة واسم الإيفنت. كله بيشتغل في المتصفح.'],
    'home.ctaBg': ['Make a background', 'اعمل خلفية'],
    'home.ctaTest': ['Test patterns', 'صور اختبار'],
    'home.toolsTitle': ['Tools', 'الأدوات'],
    'home.toolsSub': ['Pick the tool you need. The resolution carries over between tools.', 'اختار الأداة اللي محتاجها. الرزلوشن بيتنقل معاك من أداة للتانية.'],
    'home.abTitle': ['Abstract backgrounds', 'خلفيات Abstract'],
    'home.abDesc': ["Backgrounds drawn at the screen's own resolution, so they stay sharp at any size.", 'خلفيات بتترسم على رزلوشن الشاشة نفسه، فبتفضل حادة مهما كان المقاس.'],
    'home.abF1': ['16 animated and 6 static styles, 8 palettes, every color editable', '16 ستايل متحرك و 6 ثابتة، و 8 باليتات ألوان تقدر تعدّل فيها'],
    'home.abF2': ['A PNG image, or an MP4 video that loops seamlessly', 'صورة PNG، أو فيديو MP4 بيلف loop من غير قطع'],
    'home.abF3': ['Company logo and event name, with motion in video', 'لوجو الشركة واسم الإيفنت، ومعاهم حركة في الفيديو'],
    'home.open': ['Open tool', 'افتح الأداة'],
    'home.tpTitle': ['Test patterns', 'صور اختبار'],
    'home.tpDesc': ['Images for testing the screen during setup: size, mapping and color.', 'صور لاختبار الشاشة وقت التركيب: المقاس، والـ mapping، والألوان.'],
    'home.tpF1': ["Resolution from cabinets, with each cabinet's border and number", 'حساب الرزلوشن بالكابينات، وحدود كل كابينة ورقمها'],
    'home.tpF2': ['1px grid, circles, color bars and ramps', 'Grid بخطوط 1px، ودواير، و Color bars، وتدرجات'],
    'home.tpF3': ['Full R/G/B/W fields for dead-pixel checks', 'ألوان كاملة R/G/B/W لاختبار الـ dead pixels'],
    'home.howTitle': ['How it works', 'إزاي بتشتغل'],
    'home.s1': ['Enter the resolution', 'اكتب الرزلوشن'],
    'home.s1d': ['In pixels, from a preset, or from the cabinet count and size.', 'بالبكسل، أو من preset جاهز، أو احسبه بعدد الكابينات ومقاسها.'],
    'home.s2': ['Choose the look', 'اختار الشكل'],
    'home.s2d': ['Style and colors, plus the logo and event name with their position and motion.', 'الستايل والألوان، وضيف اللوجو واسم الإيفنت وحدد مكانهم وحركتهم.'],
    'home.s3': ['Download and play', 'حمّل وشغّل'],
    'home.s3d': ['Get a PNG or MP4 at the exact size and play it in Resolume on the screen.', 'نزّل PNG أو MP4 بالمقاس بالظبط، وشغّله على Resolume على الشاشة.'],
    'home.stat1': ['Max width or height in pixels', 'أقصى عرض أو ارتفاع بالبكسل'],
    'home.stat2': ['Frames per second for video', 'فريم في الثانية للفيديو'],
    'home.stat3': ['Servers: everything runs on your device', 'سيرفر: كله بيتعمل على جهازك'],
    'home.footer': ['Video export needs Chrome or Edge on a computer.', 'الفيديو محتاج Chrome أو Edge على الكمبيوتر.'],

    // ---- test patterns
    'tp.docTitle': ['LED Test Pattern', 'LED Test Pattern'],
    'tp.desc': ['Test-pattern generator for event screens at any resolution.', 'مولّد صور اختبار لشاشات الإيفنتات بأي رزلوشن'],
    'tp.presetPh': ['Preset name (e.g. Main stage)', 'اسم الـ preset (مثلاً: المسرح الرئيسي)'],
    'tp.presetAria': ['Preset name', 'اسم الـ preset'],
    'tp.save': ['Save', 'حفظ'],
    'tp.delete': ['Delete preset', 'حذف الـ preset'],
    'tp.groupBuiltin': ['Built-in', 'جاهزة'],
    'tp.groupSaved': ['Saved', 'محفوظة'],
    'tp.storeFail': ["Couldn't save: the browser is blocking storage.", 'مقدرتش أحفظ — المتصفح مانع التخزين.'],
    'tp.presetSaved': ['Saved.', 'اتحفظ.'],
    'tp.drawCab': ['Draw cabinet borders and numbers', 'رسم حدود الكابينات وأرقامها'],
    'tp.bg': ['Background', 'الخلفية'],
    'bg.black': ['Black', 'أسود'],
    'bg.solid': ['Color', 'لون'],
    'bg.bars': ['Color bars', 'Color bars'],
    'bg.gray': ['Gray ramp', 'تدرج رمادي'],
    'bg.rgb': ['RGB ramp', 'تدرج RGB'],
    'tp.bgColor': ['Background color', 'لون الخلفية'],
    'tp.elements': ['Elements', 'العناصر'],
    'tp.gridEvery': ['Grid every', 'Grid كل'],
    'tp.circles': ['Circles (to check the aspect ratio)', 'دواير (للتأكد من الـ aspect ratio)'],
    'tp.cross': ['Crosshair and diagonals', 'Crosshair وأقطار'],
    'tp.border': ['1px border and corner arrows', 'إطار 1px وأسهم الأركان'],
    'tp.info': ['Resolution info in the center', 'بيانات الرزلوشن في النص'],
    'tp.textTitle': ['Text on the image', 'نص على الصورة'],
    'tp.event': ['Event name', 'اسم الإيفنت'],
    'tp.eventPh': ['e.g. Expo 2026', 'مثال: Expo 2026'],
    'tp.screen': ['Screen name', 'اسم الشاشة'],
    'tp.screenPh': ['e.g. Main Stage', 'مثال: Main Stage'],
    'tp.download': ['Download PNG', 'تحميل PNG'],
    'tp.copyLink': ['Copy link with these settings', 'نسخ رابط بنفس الإعدادات'],
    'tp.fields': ['Full color fields (dead pixels / uniformity)', 'ألوان كاملة (Dead pixels / Uniformity)'],
    'tp.linkCopied': ['Link copied.', 'الرابط اتنسخ.'],
    'tp.copyThis': ['Copy this link: {url}', 'انسخ الرابط: {url}'],
    'tp.hint': ['The preview is scaled to fit. Downloads are exactly at full resolution.', 'المعاينة متصغرة على قد الشاشة. الملف اللي بيتحمّل بالرزلوشن الكامل بالظبط.'],

    // ---- abstract backgrounds
    'ab.docTitle': ['LED Abstract Backgrounds', 'LED Abstract Backgrounds'],
    'ab.desc': ['Abstract background images and videos for event screens at any resolution.', 'خلفيات Abstract صور وفيديو لشاشات الإيفنتات بأي رزلوشن'],
    'ab.style': ['Style', 'الستايل'],
    'ab.colors': ['Colors', 'الألوان'],
    'ab.kindAria': ['Style type', 'نوع الستايل'],
    'ab.kindAnimated': ['Animated', 'متحركة'],
    'ab.kindStatic': ['Static', 'ثابتة'],
    'ab.staticNote': ["Static designs don't move in videos. The logo and event name can still animate.", 'الخلفيات الثابتة مش بتتحرك في الفيديو، بس اللوجو واسم الإيفنت ممكن يتحركوا عادي.'],
    'ab.colorBg': ['Background color', 'لون الخلفية'],
    'ab.color1': ['Color 1', 'لون 1'],
    'ab.color2': ['Color 2', 'لون 2'],
    'ab.color3': ['Color 3', 'لون 3'],
    'ab.color4': ['Color 4', 'لون 4'],
    'ab.firstBg': ['The first color is the background.', 'أول لون هو الخلفية.'],
    'ab.shape': ['Shape', 'الشكل'],
    'ab.reseed': ['🎲 New layout', '🎲 شكل جديد'],
    'ab.density': ['Density', 'الكثافة'],
    'ab.grain': ['Light grain (reduces banding on the screen)', 'Grain خفيف (بيقلل الـ banding على الشاشة)'],
    'ab.logo': ['Company logo', 'لوجو الشركة'],
    'ab.logoPick': ['Choose an SVG or PNG file, or drop it here', 'اختار ملف SVG أو PNG، أو اسحبه هنا'],
    'ab.logoChange': ['Change logo (SVG or PNG)', 'تغيير اللوجو (SVG أو PNG)'],
    'ab.remove': ['Remove', 'إزالة'],
    'ab.sizeOfH': ['Size (of screen height)', 'الحجم (من ارتفاع الشاشة)'],
    'ab.logoPos': ['Logo position', 'مكان اللوجو'],
    'ab.logoDragHint': ['Pick a position, or drag the logo on the preview.', 'اختار مكان، أو اسحب اللوجو بالماوس على المعاينة.'],
    'ab.margin': ['Distance from edge', 'البعد عن الحافة'],
    'ab.opacity': ['Opacity', 'الشفافية'],
    'ab.motion': ['Motion in video', 'الحركة في الفيديو'],
    'ab.logoShown': ['Shown at {dim}', 'هيتعرض بمقاس {dim}'],
    'ab.logoSvgSharp': [' · SVG (stays sharp at any size)', ' · SVG (بيفضل حاد في أي مقاس)'],
    'ab.logoOrig': [' · original {dim}', ' · الأصل {dim}'],
    'ab.logoSmall': ["⚠ The logo is too small for this resolution: the original {orig} would be enlarged {x} to {dim}, so it won't look sharp on the screen. You need a version at least {h} tall, an SVG file, or a smaller size.", '⚠ اللوجو صغير على الرزلوشن ده: الأصل {orig} وهيتكبّر {x} لـ {dim}، فهيبان مش حاد على الشاشة. محتاج نسخة ارتفاعها {h} على الأقل، أو ملف SVG، أو صغّر الحجم.'],
    'ab.logoSmallShort': ["⚠ The logo will be enlarged {x} and won't be sharp.", '⚠ اللوجو هيتكبّر {x} ومش هيبقى حاد.'],
    'ab.logoSvgRaster': ['Note: this SVG contains a regular (non-vector) image, which may not stay sharp when enlarged.', 'ملحوظة: ملف الـ SVG ده جواه صورة عادية (مش vector)، فالجزء ده ممكن مايبقاش حاد لو اتكبّر.'],
    'ab.logoType': ['The file must be an SVG or PNG image.', 'الملف لازم يكون صورة SVG أو PNG.'],
    'ab.logoRead': ["Couldn't read this logo file.", 'مقدرتش أقرا ملف اللوجو ده.'],
    'ab.logoNoStore': ["The logo works, but it won't be remembered next time (the file is too large for browser storage).", 'اللوجو اشتغل، بس مش هيتحفظ للمرة الجاية (الملف كبير على تخزين المتصفح).'],
    'ab.event': ['Event name', 'اسم الإيفنت'],
    'ab.mainText': ['Main text', 'النص الرئيسي'],
    'ab.mainPh': ['e.g. Innovation Summit 2026', 'مثال: ملتقى الابتكار 2026'],
    'ab.sub': ['Second line (optional)', 'سطر تاني (اختياري)'],
    'ab.subPh': ['e.g. Cairo · 20 November', 'مثال: القاهرة · 20 نوفمبر'],
    'ab.font': ['Font', 'الخط'],
    'ab.weight': ['Weight', 'السُمك'],
    'ab.wRegular': ['Regular', 'عادي'],
    'ab.textPos': ['Text position', 'مكان النص'],
    'ab.textDragHint': ['Pick a position, or drag the text on the preview.', 'اختار مكان، أو اسحب النص بالماوس على المعاينة.'],
    'ab.color': ['Color', 'اللون'],
    'ab.shadow': ['Soft shadow', 'ظل خفيف'],
    'ab.motionNote': ['Motion shows in the video and in the preview while it plays. PNG images are exported without motion.', 'الحركة بتظهر في الفيديو وفي المعاينة وهي شغالة. الصورة PNG بتطلع من غير حركة.'],
    'ab.motionTitle': ['Motion (for video)', 'الحركة (للفيديو)'],
    'ab.speed': ['Speed', 'السرعة'],
    'ab.duration': ['Duration', 'المدة'],
    'ab.s10': ['10 seconds', '10 ثواني'],
    'ab.s15': ['15 seconds', '15 ثانية'],
    'ab.s30': ['30 seconds', '30 ثانية'],
    'ab.s60': ['60 seconds', '60 ثانية'],
    'ab.loopNote': ['The video loops seamlessly: the last frame flows into the first.', 'الفيديو بيلف loop من غير قطع: آخر فريم بيكمّل على أول فريم.'],
    'ab.dlPng': ['Download PNG image', 'تحميل صورة PNG'],
    'ab.dlMp4': ['Download MP4 video', 'تحميل فيديو MP4'],
    'ab.cancel': ['Cancel', 'إلغاء'],
    'ab.pause': ['⏸ Pause motion', '⏸ إيقاف الحركة'],
    'ab.play': ['▶ Play motion', '▶ تشغيل الحركة'],
    'ab.hint': ['The preview is scaled down. Files are made at full resolution.', 'المعاينة متصغرة. الملف بيتعمل بالرزلوشن الكامل.'],
    'ab.videoInfo': ['Video: {w}×{h} · {s} s · {fps} fps · about {mb} MB', 'الفيديو: {w}×{h} · {s} ثانية · {fps}fps · حوالي {mb} MB'],
    'ab.needChrome': ['Video export needs Chrome or Edge on a computer.', 'تحميل الفيديو محتاج Chrome أو Edge على الكمبيوتر.'],
    'ab.padded': [' — a black pixel was added because H.264 needs even numbers.', ' — اتزوّد بكسل أسود لأن H.264 محتاج أرقام زوجية.'],
    'ab.drawErr': ["Couldn't draw the image: {msg}", 'حصلت مشكلة في رسم الصورة: {msg}'],
    'ab.tainted': ['The browser refused to save the image because of the logo file. Try a PNG version of the logo.', 'المتصفح رفض يحفظ الصورة بسبب ملف اللوجو. جرّب نسخة PNG من اللوجو.'],
    'ab.left': [' · about {n} s left', ' · باقي حوالي {n} ثانية'],
    'ab.cancelled': ['Cancelled.', 'اتلغى.'],
    'ab.vidSize': ["This device can't make an H.264 video at {w}×{h}. Try another device or split the screen into several videos.", 'الجهاز ده مش قادر يعمل فيديو H.264 بمقاس {w}×{h}. جرّب جهاز تاني أو قسّم الشاشة على أكتر من فيديو.'],
    'ab.vidErr': ['Something went wrong making the video: {msg}', 'حصلت مشكلة في عمل الفيديو: {msg}'],
    'preset.thisScreen': ['This screen', 'الشاشة دي'],
    'ss.title': ['Screensaver', 'شاشة التوقف (Screensaver)'],
    'ss.intro': ['Play this background live and full screen on any computer, at its own resolution, with no file to download.', 'شغّل الخلفية دي live وبملء الشاشة على أي كمبيوتر، بالرزلوشن بتاعه، من غير ما تحمّل أي ملف.'],
    'ss.open': ['Open full screen', 'افتح بملء الشاشة'],
    'ss.copy': ['Copy screensaver link', 'نسخ اللينك'],
    'ss.copied': ['Screensaver link copied.', 'لينك الـ screensaver اتنسخ.'],
    'ss.how': ['Set it as the screensaver', 'إزاي تخليها screensaver'],
    'ss.win1': ['Install Lively Wallpaper (free, open source):', 'نزّل Lively Wallpaper (مجاني ومفتوح المصدر):'],
    'ss.win2': ['In Lively, add a wallpaper and paste the screensaver link.', 'في Lively، ضيف wallpaper جديد والصق لينك الـ screensaver.'],
    'ss.win3': ["Open Lively's Settings → Screensaver and follow the steps.", 'افتح Settings ← Screensaver في Lively وكمّل الخطوات.'],
    'ss.mac1': ['Install WebViewScreenSaver (free, open source):', 'نزّل WebViewScreenSaver (مجاني ومفتوح المصدر):'],
    'ss.mac2': ['Open System Settings → Screen Saver and choose WebViewScreenSaver.', 'افتح System Settings ← Screen Saver واختار WebViewScreenSaver.'],
    'ss.mac3': ['Open its Options and add the screensaver link.', 'افتح Options بتاعته وضيف لينك الـ screensaver.'],
    'ss.stillTitle': ['Still image, no extra app', 'صورة ثابتة من غير أي برنامج'],
    'ss.still': ['Download a PNG at your screen size (preset “This screen”), put it in a folder, and choose that folder in the built-in Photos screensaver on Windows or a photo screensaver on Mac.', 'حمّل صورة PNG بمقاس شاشتك (من preset "الشاشة دي")، وحطها في فولدر، واختار الفولدر ده في screensaver الصور اللي جوه Windows (Photos) أو في screensaver صور على الماك.'],
    'ss.logoNote': ["The event name is part of the link. The logo is saved in this browser only, so screensaver apps won't show it.", 'اسم الإيفنت جوه اللينك. اللوجو متخزن في المتصفح ده بس، فبرامج الـ screensaver مش هتعرضه.'],
    'ss.pageHint': ['Click for full screen · press Esc to exit', 'اضغط عشان ملء الشاشة · Esc للخروج'],
    'anim.none': ['No motion', 'بدون حركة'],
    'anim.fade': ['Fade in and out', 'ظهور واختفاء تدريجي'],
    'anim.slide': ['Slide up', 'طلوع من تحت'],
    'anim.zoom': ['Zoom in', 'تكبير مع الظهور'],
    'anim.float': ['Gentle float (loop)', 'طفو هادي (loop)'],
    'anim.pulse': ['Pulse (loop)', 'نبض (loop)'],
  };

  function initial() {
    let q = null;
    try { q = new URLSearchParams(location.search).get('lang'); } catch { /* ignore */ }
    if (LANGS.includes(q)) { try { localStorage.setItem(KEY, q); } catch { /* ignore */ } return q; }
    try { const s = localStorage.getItem(KEY); if (LANGS.includes(s)) return s; } catch { /* ignore */ }
    return 'en';
  }

  let lang = initial();
  const subs = [];

  function setRoot() {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  setRoot();

  function t(key, vars) {
    const e = D[key];
    let s = e ? e[lang === 'ar' ? 1 : 0] : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, n) => (n in vars ? String(vars[n]) : m));
    return s;
  }

  function apply(root) {
    const r = root || document;
    r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
    r.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
    r.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    r.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
    r.querySelectorAll('[data-i18n-content]').forEach(el => { el.setAttribute('content', t(el.dataset.i18nContent)); });
  }

  function set(l) {
    if (!LANGS.includes(l) || l === lang) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch { /* ignore */ }
    setRoot();
    apply();
    subs.forEach(f => { try { f(lang); } catch (e) { console.error(e); } });
  }

  function wireToggles() {
    document.querySelectorAll('[data-lang-toggle]').forEach(b => {
      if (b.dataset.wired) return;
      b.dataset.wired = '1';
      b.addEventListener('click', () => set(lang === 'ar' ? 'en' : 'ar'));
    });
  }

  function ready() { apply(); wireToggles(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();

  global.I18n = {
    t,
    set,
    apply: () => { apply(); wireToggles(); },
    onChange: f => subs.push(f),
    get lang() { return lang; },
  };
})(window);
