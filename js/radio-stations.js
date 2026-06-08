const RADIO_STATIONS = [
  {
    "name": "إذاعة القرآن الكريم - القاهرة",
    "url": "https://n0b.radiojar.com/8s5u5tpdtwzuv"
  },
  {
    "name": "إذاعة القرآن الكريم - مكة",
    "url": "https://stream.radiojar.com/0tpy1h0kxtzuv"
  },
  {
    "name": "إذاعة القرآن الكريم - الشارقة",
    "url": "https://quran-stream-proxy.solimananas2012.workers.dev/smcquranlive/quranradiolive/playlist.m3u8"
  },
  {
    "name": "-الإذاعة العامة - اذاعة متنوعة لمختلف القراء",
    "url": "https://backup.qurango.net/radio/mix"
  },
  {
    "name": "إذاعة -تلاوات خاشعة-",
    "url": "https://backup.qurango.net/radio/salma"
  },
  {
    "name": "إذاعة الرقية الشرعية",
    "url": "https://backup.qurango.net/radio/roqiah"
  },
  {
    "name": "أذكار الصباح",
    "url": "https://backup.qurango.net/radio/athkar_sabah"
  },
  {
    "name": "أذكار المساء",
    "url": "https://backup.qurango.net/radio/athkar_masa"
  },
  {
    "name": "إذاعة ---سورة البقرة - لعدد من القراء---",
    "url": "https://backup.qurango.net/radio/albaqarah"
  },
  {
    "name": "-تراتيل قصيرة متميزة-",
    "url": "https://backup.qurango.net/radio/tarateel"
  },
  {
    "name": "إذاعة عبدالباسط عبدالصمد (ترتيل)",
    "url": "https://backup.qurango.net/radio/abdulbasit_abdulsamad"
  },
  {
    "name": "إذاعة محمد صديق المنشاوي (تجويد)",
    "url": "https://backup.qurango.net/radio/mohammed_siddiq_alminshawi_mojawwad"
  },
  {
    "name": "إذاعة محمود خليل الحصري (ترتيل)",
    "url": "https://backup.qurango.net/radio/mahmoud_khalil_alhussary"
  },
  {
    "name": "إذاعة محمود خليل الحصري (تجويد)",
    "url": "https://backup.qurango.net/radio/mahmoud_khalil_alhussary_mojawwad"
  },
  {
    "name": "إذاعة مصطفى إسماعيل",
    "url": "https://backup.qurango.net/radio/mustafa_ismail"
  },
  {
    "name": "إذاعة محمود علي البنا (تجويد)",
    "url": "https://backup.qurango.net/radio/mahmoud_ali__albanna_mojawwad"
  },
  {
    "name": "إذاعة محمد الطبلاوي",
    "url": "https://backup.qurango.net/radio/mohammad_altablaway"
  },
  {
    "name": "إذاعة أحمد نعينع",
    "url": "https://backup.qurango.net/radio/ahmad_nauina"
  },
  {
    "name": "إذاعة عبدالرحمن السديس",
    "url": "https://backup.qurango.net/radio/abdulrahman_alsudaes"
  },
  {
    "name": "إذاعة ماهر المعيقلي",
    "url": "https://backup.qurango.net/radio/maher"
  },
  {
    "name": "إذاعة ياسر الدوسري",
    "url": "https://backup.qurango.net/radio/yasser_aldosari"
  },
  {
    "name": "إذاعة محمد أيوب - قراءة مميزة",
    "url": "https://backup.qurango.net/radio/ayyoub2"
  },
  {
    "name": "إذاعة صلاح البدير",
    "url": "https://backup.qurango.net/radio/salah_albudair"
  },
  {
    "name": "إذاعة عبدالمحسن القاسم",
    "url": "https://backup.qurango.net/radio/abdulmohsen_alqasim"
  },
  {
    "name": "إذاعة علي بن عبدالرحمن الحذيفي",
    "url": "https://backup.qurango.net/radio/ali_alhuthaifi"
  },
  {
    "name": "إذاعة عبدالله المطرود",
    "url": "https://backup.qurango.net/radio/abdullah_almattrod"
  },
  {
    "name": "إذاعة محمد اللحيدان",
    "url": "https://backup.qurango.net/radio/mohammed_allohaidan"
  },
  {
    "name": "إذاعة مصطفى اللاهوني",
    "url": "https://backup.qurango.net/radio/mustafa_allahoni"
  },
  {
    "name": "إذاعة شيخ أبو بكر الشاطري",
    "url": "https://backup.qurango.net/radio/shaik_abu_bakr_al_shatri"
  },
  {
    "name": "إذاعة مشاري العفاسي",
    "url": "https://backup.qurango.net/radio/mishary_alafasi"
  },
  {
    "name": "إذاعة أحمد العجمي",
    "url": "https://backup.qurango.net/radio/ahmad_alajmy"
  },
  {
    "name": "إذاعة ناصر القطامي",
    "url": "https://backup.qurango.net/radio/nasser_alqatami"
  },
  {
    "name": "إذاعة وليد النائحي",
    "url": "https://backup.qurango.net/radio/waleed_alnaehi"
  },
  {
    "name": "إذاعة صلاح بو خاطر",
    "url": "https://backup.qurango.net/radio/slaah_bukhatir"
  },
  {
    "name": "إذاعة صلاح الهاشم",
    "url": "https://backup.qurango.net/radio/salah_alhashim"
  },
  {
    "name": "إذاعة يوسف الشويعي",
    "url": "https://backup.qurango.net/radio/yousef_alshoaey"
  },
  {
    "name": "إذاعة بندر بليلة",
    "url": "https://backup.qurango.net/radio/bandar_balilah"
  },
  {
    "name": "إذاعة فارس عباد",
    "url": "https://backup.qurango.net/radio/fares_abbad"
  },
  {
    "name": "أحمد طالب بن حميد",
    "url": "https://backup.qurango.net/radio/a_binhameed"
  },
  {
    "name": "إذاعة عبدالبارئ الثبيتي",
    "url": "https://backup.qurango.net/radio/abdelbari_altoubayti"
  },
  {
    "name": "إذاعة أحمد صابر",
    "url": "https://backup.qurango.net/radio/ahmad_saber"
  },
  {
    "name": "إذاعة محمد عبدالكريم",
    "url": "https://backup.qurango.net/radio/mohammad_abdullkarem"
  },
  {
    "name": "إذاعة عبدالعزيز الأحمد",
    "url": "https://backup.qurango.net/radio/abdul_aziz_alahmad"
  },
  {
    "name": "إذاعة عبدالمحسن العبيكان",
    "url": "https://backup.qurango.net/radio/abdulmohsin_alobaikan"
  },
  {
    "name": "إذاعة عبدالرشيد صوفي",
    "url": "https://backup.qurango.net/radio/abdulrasheed_soufi_khalaf"
  },
  {
    "name": "إذاعة عبدالرشيد صوفي رواية السوسي",
    "url": "https://backup.qurango.net/radio/abdulrasheed_soufi_assosi"
  },
  {
    "name": "إذاعة مفتاح السلطني (الدوري عن أبي عمرو)",
    "url": "https://backup.qurango.net/radio/muftah_alsaltany_aldori_an_abi_amr "
  },
  {
    "name": "إذاعة مفتاح السلطني (الدوري)",
    "url": "https://backup.qurango.net/radio/muftah_alsaltany_aldorai"
  },
  {
    "name": "إذاعة مفتاح السلطني (ابن ذكوان عن ابن عامر)",
    "url": "https://backup.qurango.net/radio/muftah_alsaltany_ibn_thakwan_an_ibn_amr"
  },
  {
    "name": "إذاعة محمد عبدالحكيم سعيد العبدالله (البزي)",
    "url": "https://backup.qurango.net/radio/mohammad_alabdullah_albizi"
  },
  {
    "name": "إذاعة محمد عبدالحكيم سعيد العبدالله (الدوري)",
    "url": "https://backup.qurango.net/radio/mohammad_alabdullah_aldorai"
  },
  {
    "name": "إذاعة ناصر الماجد",
    "url": "https://backup.qurango.net/radio/nasser_almajed"
  },
  {
    "name": "إذاعة هيثم الجدعاني",
    "url": "https://backup.qurango.net/radio/hitham_aljadani"
  },
  {
    "name": "إذاعة خالد الجليل",
    "url": "https://backup.qurango.net/radio/khalid_aljileel"
  },
  {
    "name": "إذاعة معيض الحارثي",
    "url": "https://backup.qurango.net/radio/moeedh_alharthi"
  },
  {
    "name": "إذاعة زكي داغستاني",
    "url": "https://backup.qurango.net/radio/zaki_daghistani"
  },
  {
    "name": "إذاعة شيرزاد عبدالرحمن طاهر",
    "url": "https://backup.qurango.net/radio/shirazad_taher"
  },
  {
    "name": "إذاعة أكرم العلاقمي",
    "url": "https://backup.qurango.net/radio/akram_alalaqmi"
  },
  {
    "name": "إذاعة إدريس أبكر",
    "url": "https://backup.qurango.net/radio/idrees_abkr"
  },
  {
    "name": "إذاعة الزين محمد أحمد",
    "url": "https://backup.qurango.net/radio/alzain_mohammad_ahmad"
  },
  {
    "name": "إذاعة القارئ ياسين",
    "url": "https://backup.qurango.net/radio/alqaria_yassen"
  },
  {
    "name": "إذاعة عمر القزابري",
    "url": "https://backup.qurango.net/radio/omar_alqazabri"
  },
  {
    "name": "إذاعة نعمة الحسان",
    "url": "https://backup.qurango.net/radio/neamah_alhassan"
  },
  {
    "name": "إذاعة يحيى حوا",
    "url": "https://backup.qurango.net/radio/yahya_hawwa"
  },
  {
    "name": "إذاعة محمد صالح عالم شاه",
    "url": "https://backup.qurango.net/radio/mohammad_saleh_alim_shah"
  },
  {
    "name": "إذاعة مصطفى رعد العزاوي",
    "url": "https://backup.qurango.net/radio/mustafa_raad_alazawy"
  },
  {
    "name": "إذاعة ماهر شخاشيرو",
    "url": "https://backup.qurango.net/radio/maher_shakhashero"
  },
  {
    "name": "إذاعة خالد المهنا",
    "url": "https://backup.qurango.net/radio/khalid_almohana"
  },
  {
    "name": "إذاعة موسى بلال",
    "url": "https://backup.qurango.net/radio/mousa_bilal"
  },
  {
    "name": "إذاعة عبدالله الكندري",
    "url": "https://backup.qurango.net/radio/abdullah_alkandari"
  },
  {
    "name": "إذاعة محمد عثمان خان",
    "url": "https://backup.qurango.net/radio/mohammed_osman_khan"
  },
  {
    "name": "إذاعة الدوكالي محمد العالم",
    "url": "https://backup.qurango.net/radio/addokali_mohammad_alalim"
  },
  {
    "name": "إذاعة الفاتح محمد الزبير",
    "url": "https://backup.qurango.net/radio/alfateh_alzubair"
  },
  {
    "name": "إذاعة طارق عبدالغني دعوب",
    "url": "https://backup.qurango.net/radio/tareq_abdulgani_daawob"
  },
  {
    "name": "إذاعة أحمد ديبان",
    "url": "https://backup.qurango.net/radio/ahmad_deban"
  },
  {
    "name": "إذاعة محمد الأمين قنيوة",
    "url": "https://backup.qurango.net/radio/qeniwa"
  },
  {
    "name": "عبدالعزيز سحيم",
    "url": "https://backup.qurango.net/radio/a_sheim"
  },
  {
    "name": "إذاعة خالد عبدالكافي",
    "url": "https://backup.qurango.net/radio/khalid_abdulkafi"
  },
  {
    "name": "إذاعة محمود الشيمي",
    "url": "https://backup.qurango.net/radio/mahmood_alsheimy"
  },
  {
    "name": "إذاعة صابر عبدالحكم",
    "url": "https://backup.qurango.net/radio/saber_abdulhakm"
  },
  {
    "name": "إذاعة سيد رمضان",
    "url": "https://backup.qurango.net/radio/sayeed_ramadan"
  },
  {
    "name": "إذاعة سهل ياسين",
    "url": "https://backup.qurango.net/radio/sahl_yassin"
  },
  {
    "name": "إذاعة توفيق الصايغ",
    "url": "https://backup.qurango.net/radio/tawfeeq_assayegh"
  },
  {
    "name": "إذاعة جمال شاكر عبدالله",
    "url": "https://backup.qurango.net/radio/jamal_shaker_abdullah"
  },
  {
    "name": "إذاعة علي حجاج السويسي",
    "url": "https://backup.qurango.net/radio/ali_hajjaj_alsouasi"
  },
  {
    "name": "إذاعة عماد زهير حافظ",
    "url": "https://backup.qurango.net/radio/emad_hafez"
  },
  {
    "name": "إذاعة هاني الرفاعي",
    "url": "https://backup.qurango.net/radio/hani_arrifai"
  },
  {
    "name": "إذاعة محمود الرفاعي",
    "url": "https://backup.qurango.net/radio/mahmood_al_rifai"
  },
  {
    "name": "إذاعة محمد رشاد الشريف",
    "url": "https://backup.qurango.net/radio/mohammad_rashad_alshareef"
  },
  {
    "name": "إذاعة أحمد خضر الطرابلسي",
    "url": "https://backup.qurango.net/radio/ahmad_khader_altarabulsi"
  },
  {
    "name": "إذاعة أحمد الطرابلسي",
    "url": "https://backup.qurango.net/radio/ahmed_altrabulsi"
  },
  {
    "name": "إذاعة أحمد خليل شاهين",
    "url": "https://backup.qurango.net/radio/ahmad_shaheen"
  },
  {
    "name": "أذاعة محمد أبوسنينة",
    "url": "https://backup.qurango.net/radio/sneineh"
  },
  {
    "name": "إذاعة --تفسير القران الكريم--",
    "url": "https://backup.qurango.net/radio/tafseer"
  },
  {
    "name": "تفسير القران الكريم-الخلاصة من تفسير الطبري",
    "url": "https://backup.qurango.net/radio/tabri"
  },
  {
    "name": "المختصر في تفسير القرآن الكريم",
    "url": "https://backup.qurango.net/radio/mukhtasartafsir"
  },
  {
    "name": "تفسير غريب القرآن",
    "url": "https://backup.qurango.net/radio/gareeb-quran"
  },
  {
    "name": "المختصر في السيرة النبوية",
    "url": "https://backup.qurango.net/radio/almukhtasar_fi_alsiyra"
  },
  {
    "name": "***قصص الأنبياء***",
    "url": "https://backup.qurango.net/radio/alanbiya"
  },
  {
    "name": "---إذاعة صور من حياة الصحابة والتابعين رضوان الله عليهم---",
    "url": "https://backup.qurango.net/radio/sahabah"
  },
  {
    "name": "رياض الصالحين",
    "url": "https://backup.qurango.net/radio/riyad"
  },
  {
    "name": "صحيح البخاري",
    "url": "https://backup.qurango.net/radio/saheh-bokharee"
  },
  {
    "name": "كتاب الاختيارات الفقهية في مسائل العبادات والمعاملات",
    "url": "https://backup.qurango.net/radio/alaikhtiarat_alfiqhayh_bin_baz"
  },
  {
    "name": "فضل شهر رمضان",
    "url": "https://backup.qurango.net/radio/ramadan"
  },
  {
    "name": "إذاعة الفتاوى العامة",
    "url": "https://backup.qurango.net/radio/fatwa"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الأوردية - عبدالباسط عبدالصمد",
    "url": "https://backup.qurango.net/radio/translation_quran_urdu_basit"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الأوردية",
    "url": "https://backup.qurango.net/radio/translation_quran_urdu_sds_shur"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الأوردية",
    "url": "https://backup.qurango.net/radio/translation_quran_urdu_minsh"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الإنجليزية",
    "url": "https://backup.qurango.net/radio/translation_quran_english_basit"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الإنجليزية",
    "url": "https://backup.qurango.net/radio/translation_quran_english_bsfr"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الإنجليزية -ترجمة والك-",
    "url": "https://backup.qurango.net/radio/translation_quran_english_walk_basit"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الفرنسية",
    "url": "https://backup.qurango.net/radio/translation_quran_french"
  },
  {
    "name": "ترجمة معاني القرآن باللغة البرتغالية",
    "url": "https://backup.qurango.net/radio/translation_quran_portuguese"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الفارسية",
    "url": "https://backup.qurango.net/radio/translation_quran_farsi"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الألبانية",
    "url": "https://backup.qurango.net/radio/translation_quran_albanian"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الأمازيغية",
    "url": "https://backup.qurango.net/radio/translation_quran_tamazight"
  },
  {
    "name": "ترجمة معاني القرآن باللغة الهوسا",
    "url": "https://backup.qurango.net/radio/Translation_Quran_Hausa"
  },
  {
    "name": "ترجمة معاني القرآن باللغة المجرية",
    "url": "https://backup.qurango.net/radio/translation_quran_hungarian"
  }
];
